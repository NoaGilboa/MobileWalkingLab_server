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
  } = patientData;

  const age = calculateAge(birth_date);

  const notesText = notes.length
    ? notes.join(', ')
    : 'אין הערות קודמות.';

  const speedText = speedHistory.length
    ? speedHistory.map((entry, idx) => {
        const date = new Date(entry.measured_at).toLocaleDateString('he-IL');
        const speed = entry.speed_kmh || entry.speed;
        return `מדידה ${idx + 1}: ${speed} קמ״ש בתאריך ${date}`;
      }).join('\n')
    : 'אין היסטוריית מהירויות זמינה.';

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
      max_tokens: 300,
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
