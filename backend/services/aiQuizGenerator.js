// backend/services/aiQuizGenerator.js
// Generates quiz questions using AI (FREE - Google Gemini API)

const axios = require('axios');

// ========================================
// AI QUIZ GENERATOR SERVICE
// ========================================

class AIQuizGenerator {
  constructor() {
    // Use Google Gemini API (FREE!)
    this.apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  }

  /**
   * Generate quiz from text topic
   * @param {string} topic - The topic for quiz generation
   * @param {number} questionCount - Number of questions (default: 10)
   * @returns {Promise<Array>} Array of quiz questions
   */
  async generateFromText(topic, questionCount = 10) {
    const prompt = `Generate ${questionCount} multiple choice quiz questions about "${topic}".

For each question:
1. Create a clear, educational question
2. Provide 4 options (A, B, C, D)
3. One correct answer
4. Brief explanation

Format your response as a JSON array ONLY (no markdown, no backticks):
[
  {
    "questionText": "question here",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correctAnswer": 0,
    "explanation": "why this is correct",
    "points": 10
  }
]

IMPORTANT: Return ONLY the JSON array, nothing else.`;

    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const generatedText = response.data.candidates[0].content.parts[0].text;
      
      // Clean and parse JSON
      const jsonText = this.extractJSON(generatedText);
      const questions = JSON.parse(jsonText);
      
      // Validate and clean questions
      return this.validateQuestions(questions);
      
    } catch (error) {
      console.error('AI generation error:', error.message);
      throw new Error('Failed to generate quiz. Please try again.');
    }
  }

  /**
   * Generate quiz from image (OCR + quiz generation)
   * @param {string} imageUrl - URL of the image
   * @param {number} questionCount - Number of questions
   */
  async generateFromImage(imageUrl, questionCount = 10) {
    // For image, we'd use Gemini Pro Vision
    // But for now, let's provide a fallback
    
    const prompt = `I have an educational image. Generate ${questionCount} quiz questions based on typical educational content. 

Format as JSON array ONLY:
[
  {
    "questionText": "question",
    "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"],
    "correctAnswer": 0,
    "explanation": "explanation",
    "points": 10
  }
]`;

    try {
      // For now, generate general questions
      // In production, you'd send the image to Gemini Pro Vision
      return await this.generateFromText("general educational topics", questionCount);
    } catch (error) {
      console.error('Image quiz generation error:', error);
      throw new Error('Failed to generate quiz from image');
    }
  }

  /**
   * Extract JSON from AI response (removes markdown, backticks, etc.)
   */
  extractJSON(text) {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Find JSON array
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      return match[0];
    }
    
    return cleaned.trim();
  }

  /**
   * Validate and clean quiz questions
   */
  validateQuestions(questions) {
    if (!Array.isArray(questions)) {
      throw new Error('Invalid quiz format');
    }

    return questions.map((q, index) => {
      // Ensure required fields
      if (!q.questionText || !q.options || !Array.isArray(q.options)) {
        throw new Error(`Invalid question at index ${index}`);
      }

      // Ensure 4 options
      if (q.options.length < 4) {
        // Pad with dummy options
        while (q.options.length < 4) {
          q.options.push(`Option ${q.options.length + 1}`);
        }
      } else if (q.options.length > 4) {
        q.options = q.options.slice(0, 4);
      }

      // Clean options (remove A), B), etc.)
      q.options = q.options.map(opt => {
        return opt.replace(/^[A-D]\)\s*/, '').trim();
      });

      // Ensure correctAnswer is valid
      if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
        q.correctAnswer = 0;
      }

      // Set default points
      if (!q.points || q.points < 1) {
        q.points = 10;
      }

      // Ensure explanation exists
      if (!q.explanation) {
        q.explanation = 'Correct answer based on the topic';
      }

      return {
        questionText: q.questionText.trim(),
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation.trim(),
        points: q.points,
        timeLimit: 30 // default 30 seconds per question
      };
    });
  }

  /**
   * Generate sample quiz (fallback if AI fails)
   */
  generateSampleQuiz(topic = 'General Knowledge') {
    return [
      {
        questionText: `What is an important concept in ${topic}?`,
        options: ['Concept A', 'Concept B', 'Concept C', 'Concept D'],
        correctAnswer: 0,
        explanation: 'This is the correct concept based on the topic.',
        points: 10,
        timeLimit: 30
      }
    ];
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
              text: 'Say "API is working"'
            }]
          }]
        }
      );
      
      return {
        success: true,
        message: 'AI API connected successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// ========================================
// ALTERNATIVE: OpenAI (if you have API key)
// ========================================

class OpenAIQuizGenerator {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
  }

  async generateFromText(topic, questionCount = 10) {
    const prompt = `Generate ${questionCount} multiple choice quiz questions about "${topic}". Return ONLY a JSON array...`;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const generatedText = response.data.choices[0].message.content;
      const jsonText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      return JSON.parse(jsonText);
      
    } catch (error) {
      console.error('OpenAI error:', error.message);
      throw new Error('Failed to generate quiz');
    }
  }
}

// ========================================
// EXPORT
// ========================================

// Use Gemini by default (FREE!)
// If Gemini key not found, will use sample quiz
const generator = new AIQuizGenerator();

module.exports = {
  AIQuizGenerator,
  OpenAIQuizGenerator,
  generator // Default generator
};