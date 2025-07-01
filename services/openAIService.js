require('dotenv').config();
const OpenAI = require('openai');


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function getTreatmentRecommendation(patientData) {
  const {
    birth_date,
    gender,
    weight,
    height,
    medical_condition,
    mobility_status,
    notes = [],
    speedHistory = [],
    espHistory = {}
  } = patientData;

  const age = calculateAge(birth_date);

  const notesText = notes.length
    ? notes.join(', ')
    : 'אין הערות קודמות.';

  const speedText = speedHistory.length
    ? speedHistory.map((entry, idx) => {
        const date = new Date(entry.measured_at).toLocaleDateString('he-IL');
        const speed = entry.speed_kmh || entry.speed;
        return `מדידה ${idx + 1}: ${speed} מטר לשנייה בתאריך ${date}`;
      }).join('\n')
    : 'אין היסטוריית מהירויות זמינה.';

    const espText = espHistory && Object.keys(espHistory).length
    ? Object.entries(espHistory).map(([key, values]) => {
        if (!Array.isArray(values) || values.length === 0) return null;
        const description = values.map((v, i) => {
          const date = new Date(v.measured_at).toLocaleDateString('he-IL');
          return `מדידה ${i + 1}: ${v.value} (${date}) שחושבה עי בקר esp32 שנמצא על ההליכון איתו הלך המטופל`;
        }).join('\n');
        const label = {
          speed: " מהירות ההליכה המחושבת מהבקר ",
          distance: " מרחק שעבר המטופל במטרים",
          handPressureL: " הלחץ שהפעיל המטופל עם יד שמאל על ההליכון בעת ההליכה",
          handPressureR: " הלחץ שהפעיל המטופל עם יד ימין על ההליכון בעת ההליכה",
          footLiftL: " מספר הניתוקים של רגל שמאל של המטופל מהרצפה",
          footLiftR: " מספר הניתוקים של רגל ימין של המטופל מהרצפה",
        }[key] || key;
        return `\n${label}:\n${description}`;
      }).filter(Boolean).join('\n')
    : 'אין מדידות מהבקר.';


  const prompt = `
מטופל במעבדת הליכה ניידת:

- גיל: ${age}
- מין: ${gender}
- משקל: ${weight} ק״ג
- גובה: ${height} ס״מ
- מצב רפואי: ${medical_condition}
- מצב ניידות: ${mobility_status}
- הערות קודמות: ${notesText}
- היסטוריית מהירויות הליכה:
${speedText}
- מדדים מהבקר:
${espText}

בהתבסס על הנתונים הללו, תן המלצה טיפולית כללית לשיפור ההליכה. ההמלצה יכולה לכלול תרגילים, תדירות, שיטות לשיפור יציבה, שיווי משקל או חוזק שרירים. 
זכור – המידע משמש פיזיותרפיסטית מוסמכת להכוונה ראשונית, לא תחליף לאבחנה רפואית.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "אתה פיזיותרפיסט מומחה במעבדות הליכה, ונותן המלצות כלליות לשיפור הליכה.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    throw new Error(`Error fetching treatment recommendation: ${error.message}`);
  }
}

function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

module.exports = { getTreatmentRecommendation };
