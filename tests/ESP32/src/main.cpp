#include <ESP32Servo.h>

// Motor driver pins
#define EN1 26
#define EN2 27
#define IN1 12
#define IN2 13
#define IN3 14
#define IN4 15
#define SERVO_PIN 2

Servo myservo;


// PWM settings for ESP32
const int PWM_CHANNEL_EN1 = 0;
const int PWM_CHANNEL_EN2 = 1;
const int PWM_FREQ = 5000;       // PWM frequency in Hz
const int PWM_RESOLUTION = 8;    // 8-bit resolution (0-255)

// --- Motor control helper ---
void stopMotors() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
  ledcWrite(PWM_CHANNEL_EN1, 0);
  ledcWrite(PWM_CHANNEL_EN2, 0);
}

void moveForward(int speed) {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  ledcWrite(PWM_CHANNEL_EN1, speed);
  ledcWrite(PWM_CHANNEL_EN2, speed);
}

void moveBackward(int speed) {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  ledcWrite(PWM_CHANNEL_EN1, speed);
  ledcWrite(PWM_CHANNEL_EN2, speed);
}

void setup() {
  // Motor pins
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  // Setup PWM for motor speed control
  ledcSetup(PWM_CHANNEL_EN1, PWM_FREQ, PWM_RESOLUTION);
  ledcSetup(PWM_CHANNEL_EN2, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(EN1, PWM_CHANNEL_EN1);
  ledcAttachPin(EN2, PWM_CHANNEL_EN2);

  // Servo setup
  myservo.attach(SERVO_PIN);

  // Initial positions
  stopMotors();
  myservo.write(90); // center position
}

void loop() {
  moveForward(200);   // move forward with ~78% duty cycle
  delay(2000);

  stopMotors();
  delay(1000);

  myservo.write(120); //right
  delay(500);
  moveBackward(255);  // move backward with ~59% duty cycle
  delay(2000);

  myservo.wright(90);
  stopMotors();
  delay(2000);

  moveForward(255);
  delay(500);
  myservo.write(60);
  delay(500);

  moveFoward(255);

  delay(2000); 

  // Servo sweep test
  myservo.write(60);
  delay(1000);
  myservo.write(120);
  delay(1000);
  myservo.write(90);
  delay(1000);
}