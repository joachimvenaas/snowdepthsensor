#!/usr/bin/python
import RPi.GPIO as GPIO
import time
import requests
import json

PIN_TRIGGER = 16
PIN_ECHO = 18
URL = 'http://192.168.1.104:4321/data'

GPIO.setmode(GPIO.BOARD)

def measure():
    GPIO.setup(PIN_TRIGGER, GPIO.OUT)
    GPIO.setup(PIN_ECHO, GPIO.IN)

    GPIO.output(PIN_TRIGGER, GPIO.LOW)

    time.sleep(0.25)

    GPIO.output(PIN_TRIGGER, GPIO.HIGH)
    time.sleep(0.00001)
    GPIO.output(PIN_TRIGGER, GPIO.LOW)

    while GPIO.input(PIN_ECHO)==0:
        pass
    pulse_start_time = time.time()
    while GPIO.input(PIN_ECHO)==1:
        pass
    pulse_end_time = time.time()

    pulse_duration = pulse_end_time - pulse_start_time
    # distance = round(pulse_duration * 17150, 2)
    return pulse_duration


distances = []
for _ in range(0, 10):
    distance = measure()
    distances.append(distance)

data = { "data": distances }
headers = { 'Content-type': 'application/json' }

print("Sending data")
r = requests.post(URL, data=json.dumps(data), headers=headers)

GPIO.cleanup()
