#!/usr/bin/python
import RPi.GPIO as GPIO
import time
import statistics

PIN_TRIGGER = 16
PIN_ECHO = 18
GPIO.setmode(GPIO.BOARD)

def measure():
    GPIO.setup(PIN_TRIGGER, GPIO.OUT)
    GPIO.setup(PIN_ECHO, GPIO.IN)

    GPIO.output(PIN_TRIGGER, GPIO.LOW)

    time.sleep(1)

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
    distance = round(pulse_duration * 17150, 2)
    return distance


def calculate_confidence(distances):
    if len(distances) < 2:
        return 0

    mean_distance = sum(distances) / len(distances)
    variance = sum((x - mean_distance) ** 2 for x in distances) / len(distances)
    standard_deviation = variance ** 0.5

    confidence = 100 - (standard_deviation / mean_distance) * 100

    return max(0, confidence)

distances = []
for _ in range(0, 10):
    distance = measure()
    distances.append(distance)

print("Distances:", distances)

# remove lowest and highest values
distances.remove(min(distances))
distances.remove(max(distances))

confidence = round(calculate_confidence(distances))
distance = round(statistics.median(distances), 1)

print(f"Distance: {distance} cm | Confidence: {confidence} %")

GPIO.cleanup()
