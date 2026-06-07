# SprintPoker 🚀

Real-Time Agile Estimation Platform built with Angular 20, TailwindCSS and Firebase.

SprintPoker helps Agile teams conduct Planning Poker sessions for story estimation in real time. Team members can join a shared room, vote on story points, reveal cards, and reach consensus during Sprint Planning meetings.

## Live Demo

Deployment URL:
https://sprint-poker-0.vercel.app

## Features

### Room Management

* Create Sprint Planning sessions
* Join sessions using Room Code or Invite Link
* Copy and share room links
* Real-time participant tracking

### Real-Time Collaboration

* Live participant synchronization
* Instant vote updates
* Real-time card reveal
* New round reset functionality

### Agile Estimation

* Fibonacci estimation deck
* Consensus calculation
* Average estimate calculation
* Lowest and highest vote tracking

### Facilitator Controls

* Session facilitator role
* Optional facilitator participation in voting
* Observer mode support

### Responsive UI

* Mobile friendly
* Tablet friendly
* Desktop optimized
* Dark modern interface

## Technology Stack

### Frontend

* Angular 20
* TypeScript
* Angular Signals
* RxJS
* TailwindCSS

### Backend & Realtime

* Firebase Authentication
* Firebase Realtime Database
* Firebase Firestore

### Deployment

* Vercel

## Architecture

```text
Angular UI
      |
Angular Services
      |
Firebase Authentication
      |
Firebase Realtime Database
      |
Realtime Synchronization
```

## Local Development

Clone the repository:

```bash
git clone https://github.com/abhay-416/sprint-poker.git
cd sprint-poker
```

Install dependencies:

```bash
npm install
```

Run locally:

```bash
ng serve
```

Open:

```text
http://localhost:4200
```

## Future Enhancements

* Jira Integration
* Story Management
* Multiple Voting Decks
* Team Analytics Dashboard
* PWA Support
* CI/CD Pipeline
* Automated Testing

## Project Highlights

* AI-assisted development using Antigravity
* Real-time collaborative architecture
* Modern Angular 20 implementation
* Firebase-powered synchronization
* Production deployment on Vercel

## Author

Abhay Upadhayay

Technical Lead | Java Full Stack | Angular | Cloud | AI Enthusiast
