# Hendry & Valensia - Sangjit Invitation

This repository contains the source code for the **Sangjit Invitation** of Hendry and Valensia.

## Live Website
The invitation is live and can be accessed at: **[https://hvsangjitinvite.web.app](https://hvsangjitinvite.web.app)**

## Overview
This is a single-page invitation website built with **Astro** and **Tailwind CSS**. It includes an RSVP form that stores guest responses in **Firebase Firestore**. 

## Tech Stack
- **Astro**: Static Site Generator
- **Tailwind CSS**: Styling
- **Firebase Hosting**: Deployment and Hosting
- **Firebase Firestore**: Database for RSVPs

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Firebase Configuration
The Firebase configuration connects to the `hvsangjitinvite` project. The SDK initialization and configuration are located in `public/firebase-config.js`.
