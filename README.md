# Whatsapp_Bot
A WhatsApp automation bot built with Node.js and Python that automatically sends dashboard images to a WhatsApp group at scheduled times.  This project is designed to help teams receive real-time visual updates from dashboards directly inside WhatsApp without manually sharing reports.

Features: 
Automatically sends dashboard screenshots/images
Scheduled delivery to WhatsApp groups
WhatsApp bot integration
Runs automatically without manual intervention
Python used for caputuring dashboard images
Node.js used for WhatsApp bot communication

How it works:
Python generates or captures the latest dashboard image.
The image is saved locally or in a temporary directory.
Node.js bot connects to WhatsApp Web.
The bot automatically sends the image to a specific WhatsApp group.
The process runs on a scheduled interval.
