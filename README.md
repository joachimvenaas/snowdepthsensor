# snowdepthsensor
Measure snow depth with ultra sonic sensor.

Raspberry Pi Zero W running with a HC-SR04 ultra sonic sensor pushing data to a backend with database.

Python running on Pi to send elapsed time between trigger and echo as a payload to backend.

Run as crontab every X minutes, takes 10 measurements and send to backend (elapsed time).
Backend in Typescript (Bun) compensates temperature measured by Netatmo Outdoor Module and calculate confidence of result.

Data presented in Grafana

# 3D model (Fusion)
![image](https://github.com/joachimvenaas/snowdepthsensor/assets/102290577/c6f8ea4f-f2f2-48db-9277-d0b69980928f)
