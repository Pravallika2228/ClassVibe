// backend/services/aiQuizGenerator.js
// Enhanced AI Quiz Generator with File Support

const axios = require('axios');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;

class AIQuizGenerator {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    // ✅ FIX: Use gemini-1.5-flash (modern, faster model)
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  }

  /**
   * Generate quiz from text topic
   */
  async generateFromText(topic, questionCount = 10, difficulty = 'medium') {
    const difficultyPrompts = {
      easy: 'Create basic, fundamental questions suitable for beginners.',
      medium: 'Create intermediate-level questions that test understanding and application.',
      hard: 'Create advanced questions that require deep analysis and critical thinking.',
      expert: 'Create expert-level questions suitable for graduate students and professionals.'
    };

    const prompt = `You are a professional quiz creator for college/university students. Generate ${questionCount} high-quality multiple choice questions about "${topic}".

${difficultyPrompts[difficulty] || difficultyPrompts.medium}

Requirements:
- Questions should be clear, precise, and professional
- Avoid trivial or overly simple questions
- Include real-world applications when possible
- Each question must have exactly 4 options
- Only ONE correct answer per question
- Provide detailed explanations for why the answer is correct

Return ONLY a valid JSON array (no markdown, no backticks, no extra text):
[
  {
    "questionText": "Clear, concise question here",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0,
    "explanation": "Detailed explanation of why this answer is correct",
    "points": 10,
    "difficulty": "${difficulty}"
  }
]

CRITICAL: Return ONLY the JSON array, nothing else. No markdown formatting.`;

    try {
      console.log('🤖 Calling Gemini API...');
      
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout
        }
      );

      if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response from Gemini API');
      }

      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('✅ Gemini API response received');
      
      // Clean and parse JSON
      const jsonText = this.extractJSON(generatedText);
      const questions = JSON.parse(jsonText);
      
      // Validate and clean questions
      return this.validateQuestions(questions);
      
    } catch (error) {
      console.error('❌ AI generation error:', error.response?.data || error.message);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('AI request timed out. Please try again.');
      }
      
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      
      if (error.response?.status === 400) {
        throw new Error('Invalid API key or request. Please check your Gemini API key.');
      }
      
      throw new Error('Failed to generate quiz. Please try again.');
    }
  }

  /**
   * Generate quiz from file content (PDF, DOCX, TXT)
   */
  async generateFromFile(filePath, questionCount = 10, difficulty = 'medium') {
    try {
      console.log('📄 Reading file:', filePath);
      
      let fileContent = '';
      const ext = filePath.split('.').pop().toLowerCase();
      
      if (ext === 'pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdf(dataBuffer);
        fileContent = pdfData.text;
      } else if (ext === 'docx' || ext === 'doc') {
        const result = await mammoth.extractRawText({ path: filePath });
        fileContent = result.value;
      } else if (ext === 'txt') {
        fileContent = await fs.readFile(filePath, 'utf8');
      } else {
        throw new Error('Unsupported file type. Please use PDF, DOCX, or TXT files.');
      }
      
      // Limit content to ~8000 characters to avoid token limits
      if (fileContent.length > 8000) {
        fileContent = fileContent.substring(0, 8000) + '...';
      }
      
      console.log(`✅ File content extracted (${fileContent.length} characters)`);
      
      const prompt = `You are a professional quiz creator. Analyze the following educational content and generate ${questionCount} high-quality multiple choice questions based on the key concepts and information.

CONTENT:
${fileContent}

Requirements:
- Focus on the main concepts and important details from the content
- Create questions at ${difficulty} difficulty level
- Each question must have exactly 4 options
- Only ONE correct answer per question
- Provide detailed explanations

Return ONLY a valid JSON array:
[
  {
    "questionText": "question based on the content",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0,
    "explanation": "explanation referencing the content",
    "points": 10
  }
]`;

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );

      const generatedText = response.data.candidates[0].content.parts[0].text;
      const jsonText = this.extractJSON(generatedText);
      let questions;

        try {
          questions = JSON.parse(jsonText);
        } catch (err) {
          console.error("❌ JSON PARSE ERROR:", jsonText);
          throw new Error("AI returned invalid JSON format");
        }
      
      return this.validateQuestions(questions);
      
    } catch (error) {
      console.error('❌ File quiz generation error:', error.message);
      throw new Error('Failed to generate quiz from file: ' + error.message);
    }
  }

  /**
   * Extract JSON from AI response
   */
  extractJSON(text) {
    // Remove markdown code blocks
    let cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^[{]*/, '') // Remove text before first [ or {
      .replace(/[^}\]]*$/, ''); // Remove text after last } or ]
    
    // Find JSON array
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return arrayMatch[0];
    }
    
    // Try to find JSON object wrapped in array
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return '[' + objectMatch[0] + ']';
    }
    
    return cleaned.trim();
  }

  /**
   * Validate and clean quiz questions
   */
  validateQuestions(questions) {
    if (!Array.isArray(questions)) {
      console.error('Invalid format - not an array:', questions);
      throw new Error('Invalid quiz format - expected array of questions');
    }

    if (questions.length === 0) {
      throw new Error('No questions were generated. Please try again.');
    }

    return questions.map((q, index) => {
      // Ensure required fields
      if (!q.questionText || !q.options || !Array.isArray(q.options)) {
        console.error(`Invalid question at index ${index}:`, q);
        throw new Error(`Invalid question structure at position ${index + 1}`);
      }

      // Ensure 4 options
      while (q.options.length < 4) {
        q.options.push(`Option ${q.options.length + 1}`);
      }
      if (q.options.length > 4) {
        q.options = q.options.slice(0, 4);
      }

      // Clean options (remove A), B), etc. prefixes)
      q.options = q.options.map(opt => {
        if (typeof opt !== 'string') opt = String(opt);
        return opt.replace(/^[A-D][\)\.:\-\s]+/i, '').trim();
      });

      // Ensure correctAnswer is valid
      if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
        console.warn(`Invalid correctAnswer at index ${index}, defaulting to 0`);
        q.correctAnswer = 0;
      }

      // Set default points
      if (!q.points || q.points < 1) {
        q.points = 10;
      }

      // Ensure explanation exists
      if (!q.explanation || q.explanation.trim() === '') {
        q.explanation = 'This is the correct answer based on the topic.';
      }

      return {
        questionText: q.questionText.trim(),
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation.trim(),
        points: q.points,
        timeLimit: q.timeLimit || 30,
        difficulty: q.difficulty || 'medium'
      };
    });
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: 'Respond with: "API connection successful"'
            }]
          }]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );
      
      return {
        success: true,
        message: 'Gemini API connected successfully',
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        model: 'gemini-1.5-flash'
      };
    }
  }
}

// Export singleton instance
const generator = new AIQuizGenerator();

module.exports = {
  AIQuizGenerator,
  generator
};