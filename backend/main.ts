#!/root/.bun/bin/bun
import * as http from 'http'
import Logger from 'node-json-logger'
import { Client } from 'pg'
const logger = new Logger({ loggerName: 'snowdepth' })

const port = 4321

interface DataFromDevice {
  data: number[]
}

interface TemperatureFromDb {
  rows: any[]
}

/*
 * Measurer usage:
 * POST to /data with JSON data { "data": [ 1,2,3,4,5,6,7,8,9,10 ] }
 * MUST be 10 points!
 * 
 * Local usage:
 * cd /root/snowdepth-backend && forever start -l /root/lade_logg.txt -a -c /root/.bun/bin/bun main.ts
 */

/**
 * Calculate the confidence of the provided data in percentage
 * @param {number[]} distances Array of values
 * @returns {number} Confidence in percentage
 */
function calculateConfidence(distances: number[]): number {
  if (distances.length < 2) {
      return 0
  }

  const meanDistance: number = distances.reduce((sum, x) => sum + x, 0) / distances.length
  const variance: number = distances.reduce((sum, x) => sum + Math.pow(x - meanDistance, 2), 0) / distances.length
  const standardDeviation: number = Math.sqrt(variance)

  const confidence: number = 100 - (standardDeviation / meanDistance) * 100

  return Math.max(0, confidence)
}

/**
 * Round to the nearest 0,3 cm
 * @param {number} datapoint Number to round
 * @returns {number} Rounded number
 */
function roundToNearest3mm(datapoint: number): number {
  return Math.round(datapoint / 0.3) * 0.3
}

/**
 * Stores result in DB
 * @param {Number} distance Distance in cm
 * @param {Number} confidence Confidence in percentage (0-100)
 * @returns {Promise.<string>} Status based on result
 */
function storeInDb(distance: number, confidence: number): Promise<string> {
  return new Promise((resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: string) => void) => {
    try {
      const client = new Client({ connectionString: `postgres://${Bun.env.POSTGRES_USER}:${Bun.env.POSTGRES_PASS}@${Bun.env.POSTGRES_HOST}:${Bun.env.POSTGRES_PORT}/${Bun.env.POSTGRES_DB}` })
      client.connect((err) => {
        if (err) {
          reject('SQL tilkoblingsfeil:' + err)
        }
      })
      client.query(`INSERT INTO snowdepth ( distance, confidence ) VALUES ( '${distance}', ${confidence} )`, (err) => {
        if (err) {
          reject('Database INSERT feil: ' + err)
        }

        resolve(`SQL INSERT OK`)
        client.end()
      }) 
    } catch (err) {
      reject('Database feil: ' + err)
    }
  })
}

/**
 * Read latest temp from DB
 * @returns {Promise.<string>} Temperature in degrees celcius
 */
async function readTempFromDb(): Promise<number> {
  return new Promise((resolve: (value: number | PromiseLike<number>) => void, reject: (reason?: string) => void) => {
    const client = new Client({ connectionString: `postgres://${Bun.env.POSTGRES_USER}:${Bun.env.POSTGRES_PASS}@${Bun.env.POSTGRES_HOST}:${Bun.env.POSTGRES_PORT}/${Bun.env.POSTGRES_DB}` })

    client.connect()
      .then(() => client.query(`SELECT value FROM raw WHERE timestamp BETWEEN NOW() - interval '2 hours' AND NOW() AND tagname = 'ute_temp' ORDER BY timestamp DESC LIMIT 1`))
      .then((res: TemperatureFromDb) => { resolve(res.rows[0].value) })
      .catch((err: string) => { reject('Read temp feil: ' + err) })
      .finally(() => client.end())
  })
}

/**
 * Do stuff with the data
 * @param {String} body POST body from device
 * @param {http.ServerResponse<http.IncomingMessage>} res HTTP response object
 * @returns 
 */
async function doStuff(body: string, res: http.ServerResponse<http.IncomingMessage>) {
  let retrievedData: DataFromDevice

  // Validate JSON
  try {
    retrievedData = JSON.parse(body)
  } catch (error) {
    logger.error(`Error parsing JSON: ${error}`)
    res.writeHead(500)
    res.end('Error parsing JSON')
    return
  }
  
  try {
    // Extract data from JSON
    let data: number[] = retrievedData.data

    // Verify length of data
    if (data.length !== 10) {
      logger.error(`${data.length} tags received, expected 10`)
      res.writeHead(500)
      res.end('Wrong number of tags')
      return
    }

    // Remove largest and smallest value of data
    data.sort((a, b) => a - b)
    data.pop()
    data.shift()

    // Convert seconds to distance in cm based on temperature
    let temperature: number
    try {
      temperature = await readTempFromDb()
    } catch (error) {
      temperature = 0
      logger.debug(`Error reading temperature, using default 0`)
    }
    const speedOfSound = (20.05*(273.16 + temperature) ** 0.5) * 100

    for (let i = 0; i < data.length; i++) {
      data[i] = roundToNearest3mm(data[i] * speedOfSound / 2) // Diveded by two because we want to know the distance to the object, not the round trip
    }

    // Calculate confidence
    const confidence: number = calculateConfidence(data)
    if (confidence > 100 || confidence < 0) {
      logger.error('Invalid confidence value')
      res.writeHead(500)
      res.end('Invalid confidence value')
      return
    }

    // Find median of data
    const distance: number = data[Math.floor(data.length / 2)]
    if (distance > 200 || distance < 2) {
      logger.error('Invalid distance value')
      res.writeHead(500)
      res.end('Invalid distance value')
      return
    }

    logger.debug(`Distance: ${distance.toFixed(1)} cm | Confidence: ${confidence.toFixed(0)}% with temperature ${temperature}`)

    // Push to database
    storeInDb(distance, confidence)
      .catch((error: string) => {
        logger.error(`Error: ${error}`)
        res.writeHead(500)
        res.end(`Error: ${error}`)
        return
      })
        // Return result
        res.writeHead(200)
        res.end(`Distance: ${distance} cm | Confidence: ${confidence}%`)
  } catch (error: any) {
    logger.error(error)
    res.writeHead(500)
    res.end(`Error: ${error}`)
  }
}

// Run webserver
let server = http.createServer((req, res) => {
  if (req.url === '/data' && req.method === 'POST') {
    let body: string = ''
    req.on('data', chunk => body += chunk.toString())
    req.on('end', () => doStuff(body, res))
  } else {
    logger.warn(`${req.url} not found`)
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(port)
logger.info(`Server running at ${port}`)
