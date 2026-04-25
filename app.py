"""
app.py - Flask Backend for Smart Study Companion
=================================================
Routes:
  /               -> Render main dashboard page
  /generate-plan  -> POST: Generate study timetable (ALL days until exam)
  /chat           -> POST: AI-powered chatbot (Gemini) with fallback
"""

from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
import random, math, re, os

# -- Create Flask app --
app = Flask(__name__)

# ================================================================
#  GEMINI AI CONFIGURATION
# ================================================================
GEMINI_API_KEY = '[ENCRYPTION_KEY]'
gemini_model = None
chat_sessions = {}  # Store chat sessions per user

try:
    import google.generativeai as genai
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(
            model_name='gemini-2.0-flash',
            system_instruction="""You are 'Scholarly', a friendly and highly knowledgeable AI Study Assistant. 
You help students with their studies by:
- Explaining concepts clearly with examples
- Answering questions about ANY subject (Math, Physics, Chemistry, Biology, History, English, Computer Science, etc.)
- Providing study tips, exam strategies, and motivation
- Breaking down complex topics into simple, easy-to-understand explanations
- Giving step-by-step solutions when asked

Rules:
1. Keep responses concise but informative (2-4 paragraphs max)
2. Use bullet points, numbered lists, and formatting for clarity
3. Include relevant formulas, examples, or mnemonics when helpful
4. Be encouraging and supportive
5. If you don't know something, say so honestly
6. Focus on educational content - you're a study helper, not a general chatbot
7. Use simple language suitable for students"""
        )
        print("[OK] Gemini AI chatbot initialized successfully!")
    else:
        print("[INFO] No GEMINI_API_KEY found. Chatbot will use offline mode.")
        print("   Set it with: set GEMINI_API_KEY=your_key_here")
except ImportError:
    print("[INFO] google-generativeai not installed. Using offline chatbot.")
except Exception as e:
    print(f"[WARN] Gemini AI init error: {e}. Using offline chatbot.")


# ================================================================
#  ROUTE: Home Page
# ================================================================
@app.route('/')
def home():
    """Render the main single-page dashboard."""
    return render_template('index.html')


# ================================================================
#  ROUTE: Generate Study Plan (ALL days until exam)
# ================================================================
@app.route('/generate-plan', methods=['POST'])
def generate_plan():
    """
    Generate a complete day-by-day study plan from TODAY
    until the day BEFORE the exam date.
    Supports subject priorities: Hard subjects get more study time.
    """
    data = request.get_json()

    # --- Parse inputs ---
    raw_subjects = data.get('subjects', '')
    hours_per_day = int(data.get('hours', 4))
    exam_date_str = data.get('exam_date', '')
    priorities = data.get('priorities', {})  # { "Math": "Hard", "English": "Easy" }

    subjects = [s.strip() for s in raw_subjects.split(',') if s.strip()]
    if not subjects:
        return jsonify({'error': 'Please enter at least one subject.'}), 400

    # --- Priority weights: Hard=3, Medium=2, Easy=1 ---
    PRIORITY_WEIGHTS = {'Hard': 3, 'Medium': 2, 'Easy': 1}
    subject_weights = {}
    for subj in subjects:
        priority = priorities.get(subj, 'Medium')
        subject_weights[subj] = PRIORITY_WEIGHTS.get(priority, 2)

    # Build a weighted subject list for slot assignment
    # e.g. if Math=Hard(3), English=Easy(1) → [Math, Math, Math, English]
    weighted_subjects = []
    for subj in subjects:
        weighted_subjects.extend([subj] * subject_weights[subj])

    # --- Calculate days left until exam ---
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    try:
        exam_date = datetime.strptime(exam_date_str, '%Y-%m-%d')
        days_left = max((exam_date - today).days, 1)
    except (ValueError, TypeError):
        exam_date = today + timedelta(days=14)
        days_left = 14

    # Cap study hours at 8 per day
    slots_per_day = min(hours_per_day, 8)
    num_subjects = len(subjects)
    num_weighted = len(weighted_subjects)

    def fmt_hour(h):
        """Format as 12-hour AM/PM."""
        period = 'AM' if h < 12 else 'PM'
        display = h if h <= 12 else h - 12
        if display == 0:
            display = 12
        return f"{display}:00 {period}"

    # --- Build timetable for EVERY day from today to day before exam ---
    timetable = []
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    for day_offset in range(days_left):
        current_date = today + timedelta(days=day_offset)
        day_name = day_names[current_date.weekday()]
        date_label = current_date.strftime('%b %d, %Y')  # e.g. "Apr 15, 2026"

        day_plan = {
            'day': f"{day_name}, {date_label}",
            'date': current_date.strftime('%Y-%m-%d'),
            'is_today': (day_offset == 0),
            'slots': []
        }
        current_hour = 9  # Start at 9 AM

        # Sunday = lighter day (half slots)
        day_slots = slots_per_day if current_date.weekday() != 6 else max(slots_per_day // 2, 1)

        for slot_idx in range(day_slots):
            # Use weighted subject list so Hard subjects appear more often
            subject_index = (day_offset + slot_idx) % num_weighted
            subject = weighted_subjects[subject_index]

            day_plan['slots'].append({
                'time': f"{fmt_hour(current_hour)} - {fmt_hour(current_hour + 1)}",
                'subject': subject,
                'type': 'study'
            })
            current_hour += 1

            # 15-min break after every 2 study slots
            if (slot_idx + 1) % 2 == 0 and slot_idx < day_slots - 1:
                day_plan['slots'].append({
                    'time': f"{fmt_hour(current_hour)} (15 min)",
                    'subject': 'Break',
                    'type': 'break'
                })
                current_hour += 1

        timetable.append(day_plan)

    # --- Calculate per-subject hours ---
    subject_hours = {}
    for day in timetable:
        for slot in day['slots']:
            if slot['type'] == 'study':
                subject_hours[slot['subject']] = subject_hours.get(slot['subject'], 0) + 1

    # --- Build response ---
    response = {
        'subjects': subjects,
        'priorities': {subj: priorities.get(subj, 'Medium') for subj in subjects},
        'hours_per_day': hours_per_day,
        'days_left': days_left,
        'exam_date': exam_date_str,
        'total_days': len(timetable),
        'subject_hours': subject_hours,
        'timetable': timetable,
        'tip': random.choice([
            f"You have {days_left} days left. Your plan covers every day until the exam!",
            f"With {hours_per_day}h/day across {num_subjects} subjects, you'll cover each subject about {sum(subject_hours.values()) // num_subjects}h total.",
            f"Pro tip: Focus on {subjects[0]} in the mornings when your brain is freshest.",
            f"Sundays have lighter schedules for revision and rest.",
            f"Use the Focus Timer to track each study session and earn XP!",
            f"Hard-priority subjects get more study slots automatically!"
        ])
    }
    return jsonify(response)


# ================================================================
#  ROUTE: Conversational Chatbot
# ================================================================

# --- Subject-specific knowledge base ---
SUBJECT_KNOWLEDGE = {
    'mathematics': {
        'keywords': ['math', 'mathematics', 'algebra', 'calculus', 'geometry', 'trigonometry',
                     'equation', 'formula', 'theorem', 'integrate', 'derivative', 'fraction',
                     'number', 'probability', 'statistics', 'matrix', 'vector', 'graph',
                     'quadratic', 'linear', 'polynomial', 'logarithm', 'differentiat'],
        'responses': [
            "For Mathematics, practice is everything! Solve at least 10 problems daily. Start with easy ones and gradually increase difficulty.",
            "Key math study tip: Don't just memorize formulas, understand WHERE they come from. Derivation builds deeper understanding.",
            "For calculus: Master limits first, then derivatives, then integration. Each builds on the previous concept.",
            "Algebra tip: Always check your answer by substituting it back into the original equation.",
            "Geometry tip: Draw diagrams for every problem. Visual representation makes geometry 80% easier.",
            "Statistics tip: Understand the difference between mean, median, and mode. Know WHEN to use each one.",
            "Trigonometry tip: Remember SOH-CAH-TOA! Sin = Opposite/Hypotenuse, Cos = Adjacent/Hypotenuse, Tan = Opposite/Adjacent.",
            "Math problem-solving strategy: 1) Read carefully 2) Identify what's given 3) Identify what's asked 4) Choose the right formula 5) Solve step by step."
        ]
    },
    'physics': {
        'keywords': ['physics', 'force', 'energy', 'motion', 'newton', 'gravity', 'wave',
                     'electricity', 'magnetism', 'optics', 'thermodynamic', 'momentum',
                     'velocity', 'acceleration', 'mass', 'power', 'circuit', 'quantum',
                     'relativity', 'friction', 'pressure', 'frequency'],
        'responses': [
            "Physics tip: Always start with free body diagrams for mechanics problems. Identify ALL forces acting on the object.",
            "For Newton's Laws: F=ma is your best friend. Identify the net force, mass, and acceleration in every problem.",
            "Energy conservation: Total energy (KE + PE) stays constant in a closed system. Use this to solve complex problems easily!",
            "For circuits: Remember V=IR (Ohm's law). Series = same current, Parallel = same voltage.",
            "Waves tip: v = f x wavelength. Understand the relationship between velocity, frequency, and wavelength.",
            "Thermodynamics tip: Energy can't be created or destroyed, only transformed. Track energy flow in every problem.",
            "Physics study strategy: Understand concepts FIRST, then memorize formulas. A formula without understanding is useless.",
            "For optics: Remember - concave mirrors converge light, convex mirrors diverge light. Draw ray diagrams to visualize."
        ]
    },
    'chemistry': {
        'keywords': ['chemistry', 'chemical', 'element', 'compound', 'reaction', 'acid',
                     'base', 'organic', 'inorganic', 'periodic table', 'bond', 'molecule',
                     'atom', 'electron', 'proton', 'neutron', 'mole', 'solution',
                     'oxidation', 'reduction', 'ph', 'ion', 'valence'],
        'responses': [
            "Chemistry tip: Learn the periodic table trends (electronegativity, atomic radius, ionization energy). They explain SO much!",
            "For balancing equations: Start with the most complex molecule, balance metals first, then non-metals, then hydrogen, then oxygen.",
            "Organic Chemistry: Focus on functional groups first. Once you know -OH, -COOH, -NH2 etc., reactions become predictable.",
            "For acids and bases: Strong acids fully dissociate (HCl, H2SO4), weak acids partially dissociate (CH3COOH). pH = -log[H+].",
            "Mole concept tip: 1 mole = 6.022 x 10^23 particles = molar mass in grams. Master this conversion!",
            "Chemical bonding: Ionic bonds = metal + non-metal, Covalent bonds = non-metal + non-metal. Electronegativity difference decides.",
            "Study oxidation-reduction (redox): OIL RIG - Oxidation Is Loss, Reduction Is Gain (of electrons).",
            "Chemistry lab tip: Always add acid to water (not water to acid) - think 'Do as you oughta, add acid to water!'"
        ]
    },
    'biology': {
        'keywords': ['biology', 'cell', 'dna', 'rna', 'protein', 'gene', 'evolution',
                     'ecology', 'organism', 'photosynthesis', 'respiration', 'mitosis',
                     'meiosis', 'enzyme', 'tissue', 'organ', 'species', 'bacteria',
                     'virus', 'plant', 'animal', 'anatomy', 'physiology', 'genetic'],
        'responses': [
            "Biology tip: Use diagrams extensively! Draw and label cell structures, DNA replication, and body systems from memory.",
            "For genetics: Practice Punnett squares until they're second nature. Know dominant vs recessive, genotype vs phenotype.",
            "Photosynthesis equation: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2. Remember it happens in chloroplasts!",
            "Cell biology tip: Compare and contrast prokaryotic and eukaryotic cells. Make a table of differences.",
            "DNA tip: A pairs with T (2 hydrogen bonds), G pairs with C (3 hydrogen bonds). 'All Tigers Can Growl'",
            "Evolution tip: Natural selection = organisms with favorable traits survive and reproduce more. It's NOT random mutation alone.",
            "Enzyme tip: They are biological catalysts. Lock-and-key model = substrate fits exactly into the active site.",
            "Ecology tip: Remember the hierarchy: Organism -> Population -> Community -> Ecosystem -> Biome -> Biosphere."
        ]
    },
    'english': {
        'keywords': ['english', 'grammar', 'essay', 'writing', 'literature', 'poem',
                     'novel', 'read', 'vocabulary', 'comprehension', 'language', 'speech',
                     'paragraph', 'thesis', 'argument', 'literary', 'shakespeare'],
        'responses': [
            "Essay writing tip: Use the PEE structure - Point, Evidence, Explanation. Every paragraph needs all three!",
            "For grammar: Read widely! Exposure to correct grammar through reading improves your writing naturally.",
            "Literature analysis: Look for themes, symbols, and motifs. Ask 'Why did the author choose THIS word/image?'",
            "Vocabulary tip: Learn 5 new words daily. Use them in sentences immediately to lock them into memory.",
            "Essay structure: Introduction (hook + thesis) -> Body paragraphs (3-4, each with PEE) -> Conclusion (restate thesis + final thought).",
            "Comprehension tip: Read the questions FIRST, then read the passage. You'll know exactly what to look for.",
            "For poetry: Analyze SMILE - Structure, Meaning, Imagery, Language, Effect on reader.",
            "Writing tip: Strong verbs > adverbs. 'She sprinted' is better than 'She ran quickly'."
        ]
    },
    'history': {
        'keywords': ['history', 'war', 'revolution', 'civilization', 'empire', 'king',
                     'queen', 'century', 'ancient', 'medieval', 'modern', 'independence',
                     'constitution', 'democracy', 'political', 'social', 'economic',
                     'colonial', 'freedom', 'movement'],
        'responses': [
            "History tip: Create timelines! Chronological understanding is the backbone of history.",
            "Use the 'cause and effect' chain: every event has causes AND consequences. Link them together.",
            "For dates: Create mnemonics or stories. Associate dates with patterns you already know.",
            "Essay tip for history: Always consider multiple perspectives. Why did different groups react differently?",
            "Study history actively: Don't just read - ask 'Why did this happen? What were the consequences? Who was affected?'",
            "Source analysis: Consider who wrote it, when, why, and for whom. This reveals bias and reliability.",
            "History comparisons: Creating comparison tables between events, leaders, or time periods deepens understanding.",
            "Connect past to present: Understanding historical context makes current events much more comprehensible."
        ]
    },
    'computer': {
        'keywords': ['computer', 'programming', 'code', 'coding', 'python', 'java',
                     'algorithm', 'data structure', 'software', 'hardware', 'database',
                     'network', 'web', 'html', 'css', 'javascript', 'function',
                     'variable', 'loop', 'array', 'class', 'object', 'debug'],
        'responses': [
            "Programming tip: Write code EVERY DAY, even if just 15 minutes. Consistency builds programming skill faster than marathon sessions.",
            "Debugging strategy: Read the error message carefully, check the line number, use print statements to trace variable values.",
            "For algorithms: Understand the logic BEFORE coding. Write pseudocode or draw flowcharts first.",
            "Data structures tip: Arrays for ordered data, HashMaps for key-value pairs, Trees for hierarchical data. Know when to use each!",
            "Python tip: Use meaningful variable names. 'student_count' is better than 'x'. Your future self will thank you.",
            "Practice on platforms like LeetCode, HackerRank, or CodeWars. Start with Easy problems and work up.",
            "For web development: HTML = structure, CSS = styling, JavaScript = behavior. Master each layer separately.",
            "Computer science fundamentals: Time complexity (Big O) matters. O(n) is better than O(n^2) for large inputs."
        ]
    }
}

# --- Conversational patterns ---
CONVERSATION_PATTERNS = [
    # Greetings
    {'patterns': [r'\b(hi|hello|hey|hola|sup|yo|greetings)\b'],
     'responses': [
         "Hello! How can I help you study today? Ask me about any subject or study technique!",
         "Hey there! Ready to learn? I can help with specific subjects, study tips, exam prep, and more!",
         "Hi! Tell me what you're studying and I'll give you targeted advice!",
     ]},

    # Thanks
    {'patterns': [r'\b(thanks|thank you|thx|appreciate|helpful)\b'],
     'responses': [
         "You're welcome! Keep studying hard - you've got this!",
         "Glad I could help! Feel free to ask me anything else.",
         "No problem! Remember, consistency is the key to success.",
     ]},

    # How are you
    {'patterns': [r'how are you|how.?s it going|what.?s up'],
     'responses': [
         "I'm doing great, thanks for asking! More importantly, how's YOUR studying going? Tell me what subject you're working on!",
         "I'm ready to help you ace your studies! What are you working on today?",
     ]},

    # Who are you
    {'patterns': [r'who are you|what are you|your name|what can you do'],
     'responses': [
         "I'm Scholarly, your AI Study Assistant! I can help with: study tips for specific subjects, exam preparation strategies, focus techniques, motivation, time management, and answering your study questions. Try asking me about any subject!",
     ]},

    # Specific subject questions
    {'patterns': [r'what is|define|explain|tell me about|describe|how does|how do'],
     'responses': ['__SMART_ANSWER__']},  # Special flag for smart answering

    # Study tips
    {'patterns': [r'\b(study|learn|tip|technique|method|strategy|advice|suggest)\b'],
     'responses': [
         "Here are my top 5 study techniques:\n1. Active Recall - Test yourself without looking at notes\n2. Spaced Repetition - Review at intervals (1, 3, 7, 14 days)\n3. Feynman Technique - Explain concepts in simple words\n4. Pomodoro Method - 25 min study + 5 min break\n5. Interleaving - Mix different subjects in one session",
         "The most effective study method according to research: Active Recall + Spaced Repetition. Quiz yourself regularly and review at increasing intervals!",
         "Study smarter, not harder! Break material into chunks, teach it to others, and always test yourself instead of re-reading.",
     ]},

    # Focus & distraction
    {'patterns': [r'\b(focus|concentrate|distract|attention|procrastinat)\b'],
     'responses': [
         "Focus tips:\n1. Put phone in another room\n2. Use website blockers\n3. Try the Pomodoro technique (our Focus Timer!)\n4. Study in a dedicated space\n5. Set clear goals for each session\n6. Use background white noise/lo-fi music",
         "Can't focus? Try the '5-minute rule': commit to studying for just 5 minutes. Once you start, you'll usually keep going!",
         "Distraction solutions: Clear your desk, use noise-cancelling headphones, tell others you're studying, and set specific time blocks.",
     ]},

    # Exam & preparation
    {'patterns': [r'\b(exam|test|prepare|preparation|revision|revise|quiz|midterm|final)\b'],
     'responses': [
         "Exam preparation plan:\n1. Start 2-3 weeks before\n2. Create a topic checklist\n3. Solve past papers under timed conditions\n4. Use active recall to test yourself\n5. Focus extra time on weak areas\n6. Get good sleep the night before!",
         "For exam day: Eat well, arrive early, read ALL questions before starting, manage your time per question, and review before submitting.",
         "Best revision strategy: Don't just re-read! Use the blurting method - write everything you know from memory, then check what you missed.",
     ]},

    # Motivation
    {'patterns': [r'\b(motivat|inspire|give up|hard|difficult|stress|can.t|struggle|fail|tired|lazy|bored)\b'],
     'responses': [
         "I understand it's tough. Remember: every expert was once a beginner. The fact that you're HERE trying to study shows more strength than you realize.",
         "When motivation is low, rely on DISCIPLINE. Set a tiny goal: 'I'll study for just 10 minutes.' Small wins build momentum.",
         "Feeling overwhelmed? Break it down:\n1. Pick ONE subject\n2. Pick ONE topic in that subject\n3. Study for just 15 minutes\n4. Celebrate that you did it\n5. Repeat tomorrow",
         "You're not lazy for feeling tired - you're human. Take a 15-minute break, drink water, and come back fresh. Progress > perfection.",
     ]},

    # Time management
    {'patterns': [r'\b(time|schedule|plan|organize|routine|deadline|busy|manage)\b'],
     'responses': [
         "Time management framework:\n1. List all subjects & topics\n2. Estimate hours needed per topic\n3. Create a daily schedule (use our Timetable Generator!)\n4. Include breaks every 2 hours\n5. Review and adjust weekly",
         "Try time-blocking: assign each hour of your day to a specific task. This eliminates 'what should I do now?' paralysis.",
         "The 80/20 rule: 80% of your exam marks come from 20% of the topics. Identify the high-value topics and prioritize them!",
     ]},

    # Sleep & health
    {'patterns': [r'\b(sleep|rest|health|eat|food|exercise|water|tired|nap|energy)\b'],
     'responses': [
         "Sleep is crucial for learning! During sleep, your brain consolidates memories. Aim for 7-8 hours. All-nighters actually HURT performance.",
         "Brain fuel tips:\n1. Stay hydrated (dehydration reduces focus by 25%)\n2. Eat brain foods: nuts, berries, fish, dark chocolate\n3. Avoid heavy meals before studying\n4. Take short walks between study sessions",
         "Exercise boosts brain function! Even a 20-minute walk increases focus and memory. Try studying after a short workout.",
     ]},

    # Note-taking
    {'patterns': [r'\b(note|write|summary|summarize|outline|organize)\b'],
     'responses': [
         "Effective note-taking methods:\n1. Cornell Method: divide page into notes, cues, and summary\n2. Mind Maps: visual connections between ideas\n3. Outline Method: hierarchical bullet points\n4. Charting: use tables for comparing concepts",
         "Note-taking tip: Don't copy word-for-word! Paraphrase in your own words. This forces your brain to process the information.",
         "After taking notes, review them within 24 hours and add any missing details. This is when the forgetting curve is steepest.",
     ]},
]

# --- Smart answer database for topic questions ---
SMART_ANSWERS = {
    'photosynthesis': "Photosynthesis is the process by which plants convert sunlight, water (H2O), and carbon dioxide (CO2) into glucose and oxygen. Equation: 6CO2 + 6H2O + light -> C6H12O6 + 6O2. It occurs in chloroplasts. Two stages: light-dependent reactions (thylakoid) and Calvin cycle (stroma).",
    'mitosis': "Mitosis produces two identical daughter cells. Stages: Prophase (chromosomes condense) -> Metaphase (align at center) -> Anaphase (chromatids separate) -> Telophase (nuclear membranes reform) -> Cytokinesis (cell splits). Used for growth and repair.",
    'meiosis': "Meiosis produces 4 genetically different gametes with half the chromosomes. Two divisions (Meiosis I and II). Crossing over in prophase I creates genetic diversity. Essential for sexual reproduction.",
    'newton': "Newton's Three Laws:\n1st (Inertia): Objects stay at rest or in motion unless acted on by a force. Example: a ball stays still until kicked.\n2nd: F = ma. Heavier objects need more force.\n3rd: Every action has an equal and opposite reaction. Example: pushing a wall, the wall pushes back.",
    'gravity': "Gravity is the force of attraction between objects with mass. g = 9.8 m/s2 on Earth. Newton's law: F = G(m1*m2)/r2. Weight = mass x gravity. Einstein described it as curvature of spacetime.",
    'dna': "DNA (Deoxyribonucleic Acid) carries genetic instructions. Double helix structure with base pairs: A-T, G-C. Replicates semi-conservatively. Central Dogma: DNA -> RNA -> Protein.",
    'cell': "A cell is the basic unit of life.\nProkaryotic: no nucleus (bacteria)\nEukaryotic: has nucleus (plants, animals)\nOrganelles: nucleus (DNA), mitochondria (energy), ribosomes (proteins), ER (transport), Golgi (packaging).",
    'atom': "An atom has a nucleus (protons + neutrons) surrounded by electron shells. Atomic number = protons. Mass number = protons + neutrons. Isotopes = same element, different neutrons.",
    'periodic table': "Organizes elements by atomic number. Groups (columns) share properties. Periods (rows) = increasing atomic number. Trends: electronegativity increases right/up, atomic radius increases left/down.",
    'quadratic': "ax2 + bx + c = 0. Solve by:\n1. Factoring\n2. Quadratic formula: x = (-b +/- sqrt(b2-4ac)) / 2a\n3. Completing the square\nDiscriminant b2-4ac: >0 = two roots, =0 = one root, <0 = no real roots.",
    'pythagoras': "In a right triangle: a2 + b2 = c2 (c = hypotenuse). Example: 3,4,5 triangle. Used to find distances and unknown sides.",
    'ohm': "Ohm's Law: V = IR. V=Volts, I=Amperes, R=Ohms. Series: R_total = R1+R2. Parallel: 1/R_total = 1/R1 + 1/R2. Power = VI = I2R.",
    'acid': "Acids donate H+ ions. pH < 7. Strong: HCl, H2SO4. Weak: CH3COOH. Neutralization: Acid + Base -> Salt + Water.",
    'base': "Bases accept H+ ions or donate OH-. pH > 7. Strong: NaOH, KOH. Weak: NH3. pH + pOH = 14.",
    'oxidation': "OIL RIG: Oxidation Is Loss (of electrons), Reduction Is Gain. They always occur together in redox reactions. Example: 2Na + Cl2 -> 2NaCl.",
    'ecosystem': "An ecosystem = living organisms + their physical environment. Energy flow: Sun -> Producers -> Primary Consumers -> Secondary Consumers -> Decomposers. Food chains form food webs.",
    'evolution': "Change in inherited traits over generations. Mechanisms: natural selection, mutation, genetic drift, gene flow. Evidence: fossils, DNA similarities, comparative anatomy.",
    'momentum': "p = mv (mass x velocity). Conservation: total momentum before = after collision. Impulse = Force x time = change in momentum.",
    'wave': "Waves transfer energy without matter. Transverse (light) vs Longitudinal (sound). v = f x wavelength. Properties: reflection, refraction, diffraction, interference.",
    'fraction': "Part of a whole. Add/subtract: common denominator. Multiply: tops x tops, bottoms x bottoms. Divide: flip second and multiply.",
    'democracy': "Government by the people through elected representatives. Features: free elections, rule of law, individual rights, separation of powers.",
    'essay': "Structure: Introduction (hook + thesis) -> Body paragraphs (point + evidence + explanation) -> Conclusion (restate + summarize). Use PEE method.",
    'algorithm': "Step-by-step problem-solving procedure. Types: sorting (bubble, merge, quick), searching (binary, linear). Measured by Big O complexity.",
    'python': "High-level programming language. Dynamic typing, indentation syntax, extensive libraries. Used for web dev, data science, ML, automation.",

    # Thermoplastics & Materials
    'thermoplastic': "Thermoplastics soften when heated and harden when cooled - this is REVERSIBLE (can be remelted).\n\nCommon thermoplastics and uses:\n- PET: water bottles, food containers\n- PVC: pipes, window frames, insulation\n- Polythene (LDPE/HDPE): bags, bottles, toys\n- Polystyrene: cups, packaging, insulation\n- Nylon: clothing, gears, ropes\n- Acrylic (PMMA): lenses, signs, displays\n- Polypropylene: car parts, containers\n\nAdvantages: recyclable, lightweight, easy to mold, cheap.\nDisadvantages: weaker at high temps, can deform.",
    'thermo plastic': "Thermoplastics are polymers that become soft when heated and hard when cooled. This is REVERSIBLE.\n\nUses: PET (bottles), PVC (pipes), Polythene (bags), Nylon (clothing), Polystyrene (cups).\nAdvantages: recyclable, lightweight, easy to shape.\nUnlike thermosets, they CAN be remelted and reshaped multiple times.",
    'thermoset': "Thermosetting plastics harden permanently when heated - CANNOT be remelted.\nExamples: Bakelite (switches), Melamine (plates), Epoxy (adhesives), Polyester resin (boats).\nAdvantages: heat-resistant, strong. Disadvantages: not recyclable.",
    'polymer': "Large molecules made of repeating units (monomers). Natural: DNA, proteins, rubber, starch. Synthetic: plastics. Addition polymerization: monomers add together. Condensation: monomers join losing water.",
    'plastic': "Synthetic polymers from petrochemicals. Thermoplastics (can remelt: PET, PVC) vs Thermosets (permanent: Bakelite). Environmental concern: non-biodegradable, ocean pollution.",

    # Physics
    'force': "A push or pull (unit: Newton). Types: gravitational, friction, normal, tension, applied, air resistance. Net force = ma (Newton's 2nd law). Balanced forces = no acceleration.",
    'energy': "Capacity to do work (unit: Joule). Types: kinetic (1/2mv2), potential (mgh), thermal, chemical, electrical, nuclear, sound, light. Conservation: energy cannot be created or destroyed, only transformed.",
    'electricity': "Flow of electric charge through conductors. Current (I) = charge flow rate (Amps). Voltage (V) = electrical pressure (Volts). Resistance (R) in Ohms. V=IR. DC flows one way, AC alternates.",
    'light': "Electromagnetic radiation. Speed: 3x10^8 m/s. Wave-particle duality. Reflection (angle in=out), refraction (bending), dispersion (rainbow ROYGBIV), diffraction (spreading).",
    'sound': "Longitudinal wave from vibrations. Needs a medium (no sound in vacuum). Speed ~343 m/s in air. Frequency=pitch (Hz), amplitude=loudness (dB). Faster in solids than gases.",
    'magnet': "Produces magnetic field. North and South poles - like repel, opposite attract. Field lines: N to S. Electromagnets: current through coil, can be switched on/off. Used in motors, speakers.",
    'heat': "Thermal energy transfer. Conduction (direct contact, metals), Convection (fluid movement, warm rises), Radiation (electromagnetic waves, sunlight). Q = mc(delta T).",
    'friction': "Force opposing motion between surfaces. Types: static (not moving), kinetic (moving), rolling, fluid. Depends on surface roughness and normal force. Useful (grip) and harmful (wear).",

    # Biology
    'respiration': "Cells release energy from glucose. Aerobic: C6H12O6 + 6O2 -> 6CO2 + 6H2O + 36 ATP. Anaerobic in animals: glucose -> lactic acid + 2 ATP. In yeast: glucose -> ethanol + CO2 (fermentation).",
    'digestive': "Breaks food into absorbable nutrients. Mouth (teeth+amylase) -> Esophagus (peristalsis) -> Stomach (HCl+pepsin) -> Small intestine (main absorption, villi) -> Large intestine (water absorption). Liver makes bile, pancreas makes enzymes.",
    'heart': "4 chambers: 2 atria, 2 ventricles. Blood flow: Body -> Vena Cava -> Right Atrium -> Right Ventricle -> Lungs -> Left Atrium -> Left Ventricle -> Aorta -> Body. Double circulation system.",
    'blood': "Components: Red blood cells (carry O2 via hemoglobin), White blood cells (fight infection), Platelets (clotting), Plasma (liquid carrying nutrients). Blood types: A, B, AB, O with Rh factor.",
    'nervous system': "Controls body functions. CNS (brain + spinal cord) and PNS (body nerves). Neurons transmit electrical signals. Reflex arc: stimulus -> receptor -> sensory neuron -> relay -> motor neuron -> effector.",
    'plant': "Make food via photosynthesis. Parts: roots (absorb water/minerals), stem (transport via xylem/phloem), leaves (photosynthesis, stomata), flowers (reproduction). Cells have cell wall + chloroplasts.",
    'virus': "Not truly alive - needs a host cell to reproduce. Structure: genetic material (DNA/RNA) + protein coat (capsid). Examples: COVID-19, influenza, HIV. Cannot be treated with antibiotics (use antivirals).",
    'bacteria': "Single-celled prokaryotes (no nucleus). Have cell wall, cell membrane, cytoplasm, DNA ring, ribosomes, some have flagella. Can be helpful (gut bacteria, decomposition) or harmful (infections). Treated with antibiotics.",
    'enzyme': "Biological catalysts (speed up reactions without being used up). Lock and key model: substrate fits into active site. Affected by temperature (denature at high temp), pH, and concentration. Examples: amylase, protease, lipase.",

    # Chemistry
    'bonding': "How atoms join. Ionic: metal+non-metal, electrons transferred, forms ions. Covalent: non-metal+non-metal, electrons shared. Metallic: metal+metal, sea of delocalized electrons. Each has different properties.",
    'chemical reaction': "Reactants transform into products. Signs: color change, gas, temp change, precipitate. Types: combustion, neutralization, decomposition, displacement. Rate affected by temp, concentration, surface area, catalysts.",
    'element': "Pure substance of one atom type. 118 known. Metals (shiny, conductive), Non-metals (dull, brittle), Metalloids (properties of both). Represented by symbols (H, O, Fe).",
    'compound': "Two or more elements chemically bonded in fixed ratio. H2O, CO2, NaCl. Different properties from constituent elements. Separated only by chemical reactions.",
    'mixture': "Two+ substances NOT chemically bonded. Homogeneous (solutions) vs Heterogeneous (sand+water). Separated by: filtration, distillation, chromatography, evaporation.",
    'carbon': "Element with 4 bonding electrons. Forms of carbon: diamond (hard, tetrahedral), graphite (soft, layers), graphene (single layer), fullerenes, carbon nanotubes. Basis of organic chemistry and all life.",
    'metal': "Properties: shiny, malleable, ductile, good conductors of heat/electricity. React with acids to form salt + hydrogen. React with oxygen to form metal oxides. Reactivity series: K, Na, Ca, Mg, Al, Zn, Fe, Cu, Ag, Au.",
    'salt': "Formed when acid reacts with base (neutralization). Acid + Metal -> Salt + Hydrogen. Acid + Base -> Salt + Water. Acid + Carbonate -> Salt + Water + CO2. NaCl = common table salt.",
    'electrolysis': "Using electricity to decompose a compound. Cathode (-) attracts cations (+), Anode (+) attracts anions (-). Used to extract reactive metals (aluminum), purify copper, and electroplate objects.",

    # Math
    'algebra': "Using letters for unknowns. Expressions: 3x+5. Equations: solve for x. Expanding: a(b+c) = ab+ac. Factoring: ab+ac = a(b+c). Solve by doing same operation to both sides.",
    'trigonometry': "Relationships between triangle sides and angles. SOH CAH TOA:\nsin = Opposite/Hypotenuse\ncos = Adjacent/Hypotenuse\ntan = Opposite/Adjacent\nUsed in navigation, engineering, physics.",
    'calculus': "Study of change. Differentiation: finding rate of change (dy/dx). If y=xn, dy/dx=nxn-1. Integration: finding area under curve (reverse of differentiation). Used in physics, economics, engineering.",
    'percentage': "Per hundred. Percentage = (Part/Whole) x 100. Increase = ((New-Old)/Old) x 100. 25% of 200 = 50.",
    'probability': "P(event) = favorable/total outcomes. Range: 0 to 1. P(not A) = 1-P(A). P(A and B) = P(A)xP(B) for independent events.",
    'geometry': "Study of shapes. Circle: A=pi*r2. Rectangle: A=lxw. Triangle: A=1/2*bxh. Sphere: V=4/3*pi*r3. Angles in triangle=180 degrees.",
    'statistics': "Collecting and interpreting data. Mean=sum/count. Median=middle value. Mode=most frequent. Range=highest-lowest. Standard deviation=spread.",
    'logarithm': "The inverse of exponentiation. If 10^x = 1000, then log10(1000) = 3. Rules: log(ab) = log(a)+log(b). log(a/b) = log(a)-log(b). log(a^n) = n*log(a). Natural log uses base e.",
    'matrix': "A rectangular array of numbers arranged in rows and columns. Operations: addition, subtraction, multiplication. Determinant and inverse used to solve systems of equations. Used in graphics, AI, engineering.",
    'integration': "Finding the area under a curve. The reverse of differentiation. Integral of xn = xn+1/(n+1) + C. Definite integrals have limits. Used to find areas, volumes, displacement from velocity.",
    'differentiation': "Finding the rate of change (slope/gradient). If y = xn, then dy/dx = nxn-1. Product rule, quotient rule, chain rule for complex functions. Used for finding maxima/minima, velocity from displacement.",

    # Computer Science
    'programming': "Writing instructions for computers. Key concepts: variables, data types, if/else, loops, functions, arrays, OOP. Languages: Python, JavaScript, Java, C++.",
    'binary': "Base-2 using 0 and 1. Computers use binary (on/off states). 1101 binary = 1x8+1x4+0x2+1x1 = 13 decimal. 8 bits = 1 byte.",
    'internet': "Global network of connected computers. IP addresses identify devices. DNS translates domain names. HTTP/HTTPS for web pages. TCP/IP for communication.",
    'database': "Organized collection of data. Relational databases use tables with rows and columns. SQL is the language to query databases. NoSQL databases (MongoDB) store flexible data structures.",
    'html': "HyperText Markup Language - the standard language for creating web pages. Uses tags like <h1>, <p>, <div>, <a>. Combined with CSS (styling) and JavaScript (interactivity).",
    'css': "Cascading Style Sheets - controls the visual presentation of HTML. Properties: color, font-size, margin, padding, display, flexbox, grid. Responsive design adapts to screen sizes.",
    'javascript': "Programming language of the web. Runs in browsers. Used for interactive web pages, animations, form validation. Frameworks: React, Angular, Vue. Also server-side with Node.js.",
    'machine learning': "Branch of AI where computers learn from data without explicit programming. Types: supervised (labeled data), unsupervised (find patterns), reinforcement (learn from rewards). Used in image recognition, NLP, recommendations.",
    'artificial intelligence': "Machines that simulate human intelligence. Types: narrow AI (specific tasks like Siri), general AI (human-level, theoretical). Techniques: machine learning, deep learning, NLP. Applications: chatbots, self-driving cars, medical diagnosis.",

    # History
    'world war': "WWI (1914-18): Allies vs Central Powers, 17M deaths, Treaty of Versailles.\nWWII (1939-45): Allies vs Axis, 70-85M deaths, ended with atomic bombs. Caused by fascism, Nazi aggression.",
    'french revolution': "1789-1799. Causes: inequality, financial crisis, Enlightenment ideas. Key events: Storming of Bastille, execution of Louis XVI, Reign of Terror. Led to end of absolute monarchy.",
    'constitution': "Supreme law of a country. Indian Constitution: longest written, adopted Nov 26 1949, enacted Jan 26 1950. Features: fundamental rights, directive principles, federal structure, parliamentary system.",
    'industrial revolution': "Late 1700s-1800s. Shift from hand production to machines. Started in Britain. Key inventions: steam engine, spinning jenny, power loom. Led to urbanization, factory system, new social classes.",

    # Geography
    'plate tectonics': "Earth's shell divided into moving plates. Convergent (collide: mountains), Divergent (apart: ridges), Transform (slide past: earthquakes). Evidence: continental drift, fossils.",
    'climate change': "Long-term temperature/weather changes. Causes: fossil fuels, deforestation, agriculture. Effects: rising seas, extreme weather, ice melting. Solutions: renewable energy, reducing emissions.",
    'water cycle': "Evaporation (water->vapor) -> Condensation (vapor->clouds) -> Precipitation (rain/snow) -> Collection (rivers/oceans) -> Infiltration (groundwater). Driven by solar energy.",
    'earthquake': "Sudden release of energy in Earth's crust causing seismic waves. Caused by tectonic plate movement. Measured on Richter scale. Focus = origin point underground. Epicenter = point on surface above focus.",
    'volcano': "Opening in Earth's surface where magma erupts as lava. Types: shield (gentle slopes), composite (steep), cinder cone (small). Found at plate boundaries and hot spots. Products: lava, ash, pyroclastic flows.",

    # Economics
    'supply demand': "As price rises, demand falls and supply rises. Equilibrium where curves intersect. Shifts caused by income, preferences, technology changes.",
    'inflation': "General price increase over time. Causes: demand-pull, cost-push. Measured by CPI. Controlled by central banks via interest rates.",
    'gdp': "Total value of goods/services produced in a country. GDP = C+I+G+(X-M). Real GDP adjusts for inflation. GDP per capita = GDP/population.",
}


@app.route('/chat', methods=['POST'])
def chat():
    """
    AI-powered chatbot using Google Gemini.
    Falls back to offline pattern-matching if API is unavailable.
    """
    data = request.get_json()
    message = (data.get('message', '') or '').strip()
    session_id = data.get('session_id', 'default')

    if not message:
        return jsonify({'reply': "Hi! I'm Scholarly, your AI Study Assistant. Ask me anything — I can explain concepts, solve problems, give study tips, and more!"})

    # --- Try Gemini AI first ---
    if gemini_model:
        try:
            # Get or create chat session for this user
            if session_id not in chat_sessions:
                chat_sessions[session_id] = gemini_model.start_chat(history=[])
            
            chat_session = chat_sessions[session_id]
            response = chat_session.send_message(message)
            reply = response.text

            # Clean up markdown for display
            reply = reply.replace('**', '').replace('##', '').replace('# ', '')
            
            return jsonify({'reply': reply, 'source': 'gemini'})
        except Exception as e:
            print(f"[ERROR] Gemini API error: {e}")
            # Fall through to offline mode
    else:
        print("[INFO] gemini_model is None, using offline fallback")

    # --- OFFLINE FALLBACK: Smart fuzzy matching ---
    msg_lower = message.lower()
    msg_words = set(re.findall(r'[a-z]+', msg_lower))

    # 0. Fuzzy match against SMART_ANSWERS (MOST IMPORTANT - check first)
    best_answer = None
    best_score = 0
    for key, answer in SMART_ANSWERS.items():
        key_words = set(key.lower().split())
        # Score: how many key words appear in the message
        score = 0
        for kw in key_words:
            if kw in msg_lower:
                score += 3  # exact substring match
            for mw in msg_words:
                if kw in mw or mw in kw:
                    score += 2  # partial word match
        # Also check if key itself appears in message
        if key in msg_lower:
            score += 10
        if score > best_score:
            best_score = score
            best_answer = answer

    if best_score >= 3 and best_answer:
        # Store last topic for context in follow-up questions
        if session_id not in chat_sessions:
            chat_sessions[session_id] = {}
        chat_sessions[session_id] = {'last_answer': best_answer, 'last_msg': message}
        return jsonify({'reply': best_answer})

    # 1. Check for "what is / explain / define" questions with broader matching
    smart_match = re.search(r'(?:what is|what are|define|explain|tell me about|describe|how does|how do(?:es)?|use of|uses of|meaning of|about)\s+(.+)', msg_lower)
    if smart_match:
        topic = smart_match.group(1).strip().rstrip('?. ')
        topic_words = set(re.findall(r'[a-z]+', topic))
        # Search SMART_ANSWERS with fuzzy matching
        best_match_answer = None
        best_match_score = 0
        for key, answer in SMART_ANSWERS.items():
            score = 0
            key_parts = set(key.lower().split())
            for tw in topic_words:
                for kp in key_parts:
                    if tw == kp:
                        score += 5
                    elif tw in kp or kp in tw:
                        score += 3
                    elif len(tw) > 3 and len(kp) > 3 and (tw[:4] == kp[:4]):
                        score += 2  # prefix match (e.g., "thermo" matches "thermoplastic")
            if score > best_match_score:
                best_match_score = score
                best_match_answer = answer
        if best_match_score >= 3 and best_match_answer:
            return jsonify({'reply': best_match_answer})

    # 2. Check for context-aware follow-ups (if user says a single word like "biology" after a previous question)
    if session_id in chat_sessions and isinstance(chat_sessions[session_id], dict):
        last_context = chat_sessions[session_id].get('last_answer', '')
        if last_context and len(msg_words) <= 3:
            # User might be following up with a subject name or short query
            for key, answer in SMART_ANSWERS.items():
                if key in msg_lower or msg_lower.strip() in key:
                    return jsonify({'reply': answer})

    # 3. Check subject-specific knowledge
    best_subject = None
    best_subject_score = 0
    for subject, data_dict in SUBJECT_KNOWLEDGE.items():
        score = sum(1 for kw in data_dict['keywords'] if kw in msg_lower)
        if score > best_subject_score:
            best_subject_score = score
            best_subject = subject
    if best_subject and best_subject_score >= 1:
        return jsonify({'reply': random.choice(SUBJECT_KNOWLEDGE[best_subject]['responses'])})

    # 4. Check conversation patterns
    for pattern_group in CONVERSATION_PATTERNS:
        for pattern in pattern_group['patterns']:
            if re.search(pattern, msg_lower):
                response = random.choice(pattern_group['responses'])
                if response == '__SMART_ANSWER__':
                    # Try one more fuzzy search before giving up
                    for key, answer in SMART_ANSWERS.items():
                        for word in msg_words:
                            if len(word) > 3 and (word in key or key in word):
                                return jsonify({'reply': answer})
                    return jsonify({'reply': f"Great question! Here's what I can help with: try asking me to 'explain [topic]' or 'what is [concept]'. I know about physics, chemistry, biology, math, computer science, history, and more!"})
                return jsonify({'reply': response})

    # 5. Last resort - try matching any word against SMART_ANSWERS
    for word in msg_words:
        if len(word) > 3:
            for key, answer in SMART_ANSWERS.items():
                if word in key or key in word:
                    return jsonify({'reply': answer})

    # 6. Final fallback
    return jsonify({'reply': f"I'd be happy to help with that! Try asking me specific questions like:\n- 'What is thermoplastic?'\n- 'Explain Newton's laws'\n- 'How does photosynthesis work?'\n- 'What is DNA?'\n- 'Explain quadratic equations'\n\nI can cover Physics, Chemistry, Biology, Math, Computer Science, History, Geography, and more!"})


# -- Run the server --
if __name__ == '__main__':
    print("=" * 55)
    print("   Smart Study Companion - Scholarly")
    print("   Running at: http://localhost:5000")
    print("=" * 55)
    app.run(debug=True, port=5000, host='0.0.0.0')
