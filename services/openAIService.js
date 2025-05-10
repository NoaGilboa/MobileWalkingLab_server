require('dotenv').config();
const OpenAI = require('openai');


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


async function getTreatmentRecommendation(patientData) {
    const notes = patientData.notes ? patientData.notes.join(', ') : "אין הערות קודמות.";
    const prompt = `
        מטופל:
        גיל: ${patientData.age}
        מצב רפואי: ${patientData.condition}
        היסטוריית הערות: ${notes}

        תן לי המלצה רפואית כללית על סמך הנתונים הללו.
    `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: "אתה מומחה רפואי המספק המלצות כלליות לטיפול." },
                       { role: "user", content: prompt }],
            max_tokens: 150
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        throw new Error(`Error fetching treatment recommendation: ${error.message}`);
    }
}

module.exports = { getTreatmentRecommendation };
