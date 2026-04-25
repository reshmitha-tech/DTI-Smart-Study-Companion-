# 🎓 Smart Study Companion  
### AI-Based Personalized Learning & Focus System  

---

## 📌 Overview  
Smart Study Companion is a **Flask-based web application** designed to help students manage their studies effectively.  
It generates personalized study plans, improves focus, tracks progress, and motivates users through rewards and streaks.

---

## 🚀 Features  

### 📅 Smart Timetable Generator  
- Generates study plan based on subjects, study hours, and exam date  
- Supports **priority-based scheduling (Easy / Medium / Hard)**  

---

### ⏱️ Focus Mode (Pomodoro Timer)  
- 25-minute study sessions with 5-minute breaks  
- Detects tab switching and alerts user  

---

### 🤖 Chatbot Assistant  
- Provides study-related suggestions and answers  
- Supports AI integration using API key  

---

### 📊 Progress Analytics Dashboard  
- Weekly progress tracking  
- Study time visualization using charts  
- Displays performance insights  

---

### 🎮 Gamification System  
- Points awarded for study sessions  
- 🔥 Streak tracking (daily consistency)  
- Consistency score calculation  

---

### 🎯 Additional Features  
- Daily goal tracking  
- Most studied subject detection  
- Local storage for saving progress  

---

## ⚙️ Tech Stack  

- **Frontend:** HTML, CSS, JavaScript  
- **Backend:** Flask (Python)  
- **Charts:** Chart.js  
- **Storage:** Browser LocalStorage  

---

## 🧠 How It Works  

1. User enters subjects, study hours, exam date, and priority  
2. Backend processes data and generates timetable  
3. User studies using focus mode  
4. System tracks sessions and updates progress  
5. Points, streaks, and consistency score are calculated  
6. Dashboard displays analytics  

---

## 🤖 Chatbot Configuration  

### 🔹 Default Behavior  
- The chatbot works using a **rule-based system**, so it functions even without any external API.

---

### 🔹 Optional AI Integration  
- To enable advanced AI responses:

1. Create a `.env` file in the project root
2. API_KEY=your_api_key_here

2. Install dotenv

---

bash

- pip install python-dotenv

- Update backend code to load API key securely

- ⚠️ Note
- API keys are not included in this repository for security reasons
- If no API key is provided, chatbot automatically uses fallback responses
  
- 🔄 Project Structure

smart-study-companion/
- │
- ├── app.py
- ├── templates/
- │   └── index.html
- ├── static/
- │   ├── style.css
- │   └── script.js

- ▶️ How to Run
- Clone the repository

- Bash
- git clone https://github.com/your-username/smart-study-companion.git
- Navigate to project folder

- Bash
- cd smart-study-companion

- Install dependencies
- Bash
- pip install flask python-dotenv

- Run the application
- Bash
- python app.py

- Open browser
- http://127.0.0.1:5000/


🌟 Key Highlights
- Priority-based study planning
- Focus and distraction tracking
- Real-time progress analytics
- Gamification with streaks and rewards
- Works with  API integration


🚀 Future Enhancements
- Fully AI-powered chatbot
- proper working of chatbot
- Mobile application
- Cloud database integration
- Voice assistant
- Advanced analytics
