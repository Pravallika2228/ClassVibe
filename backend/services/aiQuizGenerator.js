// backend/services/aiQuizGenerator.js
// Enhanced AI Quiz Generator with Multiple Question Types (Groq API)

const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;

class AIQuizGenerator {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    // ✅ Priority list - if first is decommissioned, auto-tries next
    this.modelFallbacks = [
      'llama-3.1-8b-instant',        // Fast, almost never decommissioned
      'llama3-8b-8192',              // Backup
      'mixtral-8x7b-32768',         // Another stable option
      'gemma2-9b-it'                 // Google's model on Groq
    ];
    
    this.model = this.modelFallbacks[0]; // Start with first
  }

  // ✅ NEW: Auto-find working model
  async getWorkingModel() {
    for (const model of this.modelFallbacks) {
      try {
        await axios.post(
          this.apiUrl,
          {
            model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: 8000
          }
        );
        console.log(`✅ Using model: ${model}`);
        this.model = model;
        return model;
      } catch (err) {
        const reason = err.response?.data?.error?.code || err.message;
        console.warn(`⚠️ Model ${model} unavailable (${reason}), trying next...`);
      }
    }
    throw new Error('All Groq models are currently unavailable. Please try again later.');
  }

  /**
   * Generate quiz from text topic with multiple question types
   */
  async generateFromText(topic, questionCount = 6, difficulty = 'medium') {
    const difficultyPrompts = {
      easy: 'Create basic, fundamental questions suitable for beginners.',
      medium: 'Create intermediate-level questions that test understanding and application.',
      hard: 'Create advanced questions that require deep analysis and critical thinking.',
      expert: 'Create expert-level questions suitable for graduate students and professionals.'
    };

    const prompt = `You are a professional quiz creator for college/university students. Generate ${questionCount} concise questions about "${topic}". 
     Return ONLY JSON.

      ${difficultyPrompts[difficulty] || difficultyPrompts.medium}

      QUESTION TYPE DISTRIBUTION:
      - 60% Multiple Choice (4 options, 1 correct answer)
      - 20% Fill in the Blanks (single word/short phrase answer)
      - 10% True/False
      - 10% Multiple Select (select all correct answers)

      Requirements:
      - Questions should be clear, precise, and professional
      - Avoid trivial or overly simple questions
      - Include real-world applications when possible
      - Multiple Choice: exactly 4 options, only ONE correct answer
      - Fill in the Blanks: one word or short phrase answer (lowercase)
      - True/False: statement that can be definitively true or false
      - Multiple Select: 2-3 correct answers out of 4-5 options
      - Provide detailed explanations for all answers

      Return ONLY a valid JSON array (no markdown, no backticks, no extra text):
      [
        {
          "questionText": "Clear, concise question here",
          "questionType": "multiple_choice",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correctAnswer": 0,
          "explanation": "Detailed explanation",
          "points": 10
        },
        {
          "questionText": "The _____ is the powerhouse of the cell",
          "questionType": "fill_in_blank",
          "correctAnswer": "mitochondria",
          "options": [],
          "explanation": "Mitochondria generate ATP through cellular respiration",
          "points": 10
        },
        {
          "questionText": "DNA is made of nucleotides",
          "questionType": "true_false",
          "correctAnswer": true,
          "options": ["True", "False"],
          "explanation": "DNA is a polymer of nucleotides",
          "points": 10
        },
        {
          "questionText": "Select all programming languages (multiple select)",
          "questionType": "multiple_select",
          "options": ["Python", "HTML", "JavaScript", "CSS", "Java"],
          "correctAnswer": [0, 2, 4],
          "explanation": "Python, JavaScript, and Java are programming languages",
          "points": 15
        }
      ]

      CRITICAL: Return ONLY the JSON array, nothing else. No markdown formatting.`;

    try {
      await this.getWorkingModel(); // ✅ ADD THIS LINE - auto-selects working model
      console.log('🤖 Calling Groq API...');
      // ... rest of existing code unchanged

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Return only JSON quiz questions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 1500
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 60000
        }
      );

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from Groq API');
      }

      const generatedText = response.data.choices[0].message.content;
      console.log('✅ Groq API response received');

      // Clean and parse JSON
      const jsonText = this.extractJSON(generatedText);
      const questions = JSON.parse(jsonText);

      // Validate and clean questions
      return this.validateQuestions(questions);

    } catch (error) {
      console.error('❌ AI generation error:', error.response?.data || error.message);

      if (error.code === 'ECONNABORTED') {
        throw new Error('AI request timed out. The topic might be too complex. Try a simpler one.');
      }

      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }

      if (error.response?.status === 401) {
        throw new Error('Invalid Groq API key. Please check your GROQ_API_KEY.');
      }

      throw new Error('Failed to generate quiz. Please try again with a different topic.');
    }
  }

  /**
   * Generate quiz from file content (PDF, DOCX, TXT)
   */
  async generateFromFile(filePath, questionCount = 6, difficulty = 'medium', description = '') {
    try {
      await this.getWorkingModel(); // ✅ ADD THIS LINE - auto-selects working model
      console.log('📄 Reading file:', filePath);

      let fileContent = '';
      const ext = filePath.split('.').pop().toLowerCase();

      // ✅ IMPROVED: Better file reading with error handling
      try {
        if (ext === 'pdf') {
          const dataBuffer = await fs.readFile(filePath);
          const pdfData = await pdfParse(dataBuffer);
          fileContent = pdfData.text;
          
          if (!fileContent || fileContent.trim().length < 100) {
            throw new Error('PDF appears to be empty or has very little text. Please ensure the PDF contains readable text (not just images).');
          }
        } 
        else if (ext === 'docx' || ext === 'doc') {
          const result = await mammoth.extractRawText({ path: filePath });
          fileContent = result.value;
          
          if (!fileContent || fileContent.trim().length < 100) {
            throw new Error('Document appears to be empty. Please ensure it contains readable text.');
          }
        } 
        else if (ext === 'txt') {
          fileContent = await fs.readFile(filePath, 'utf8');
          
          if (!fileContent || fileContent.trim().length < 100) {
            throw new Error('Text file appears to be empty.');
          }
        } 
        else {
          throw new Error(`Unsupported file type: .${ext}. Please use PDF, DOCX, or TXT files.`);
        }
      } catch (readError) {
        console.error('❌ File reading error:', readError.message);
        throw new Error(`Cannot read file: ${readError.message}`);
      }

      // Clean content
      fileContent = fileContent
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();

      // ✅ IMPROVED: Better content chunking (limit to ~8000 characters)
      if (fileContent.length > 8000) {
        console.log(`⚠️ Content too long (${fileContent.length} chars), truncating to 8000...`);
        fileContent = fileContent.substring(0, 8000) + '...';
      }

      console.log(`✅ File content extracted (${fileContent.length} characters)`);

      const descriptionPrompt = description 
        ? `\n\nUSER GUIDANCE: ${description}\nGenerate questions focusing on this aspect.`
        : '';

      const prompt = `You are a professional quiz creator. Analyze the following educational content and generate ${questionCount} high-quality questions.${descriptionPrompt}

        CONTENT:
        ${fileContent}

        QUESTION TYPE DISTRIBUTION:
        - 60% Multiple Choice (4 options, 1 correct answer)
        - 20% Fill in the Blanks (one word answer)
        - 10% True/False
        - 10% Multiple Select (2-3 correct answers)

        Requirements:
        - Focus on key concepts and important details from the content
        - Create questions at ${difficulty} difficulty level
        - All questions must be directly answerable from the provided content
        - Provide detailed explanations referencing the content

        Return ONLY a valid JSON array with this EXACT structure:
        [
          {
            "questionText": "question text",
            "questionType": "multiple_choice",
            "options": ["A", "B", "C", "D"],
            "correctAnswer": 0,
            "explanation": "why this is correct",
            "points": 10
          },
          {
            "questionText": "Fill blank: The _____ is...",
            "questionType": "fill_in_blank",
            "correctAnswer": "answer_word",
            "options": [],
            "explanation": "explanation",
            "points": 10
          }
        ]`;

      console.log('🤖 Sending file content to Groq API...');

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Return only JSON quiz questions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 1500
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 60000
        }
      );

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Groq API returned empty response');
      }

      const generatedText = response.data.choices[0].message.content;
      console.log('✅ Groq response received, parsing JSON...');

      const jsonText = this.extractJSON(generatedText);
      let questions;

      try {
        questions = JSON.parse(jsonText);
      } catch (parseError) {
        console.error("❌ JSON PARSE ERROR:", jsonText.substring(0, 500));
        throw new Error("AI returned invalid JSON format. Please try again or use a different file.");
      }

      console.log(`✅ Successfully parsed ${questions.length} questions`);

      return this.validateQuestions(questions);

    } catch (error) {
      console.error('❌ File quiz generation error:', error.message);
      
      // ✅ IMPROVED: Better error messages
      if (error.message.includes('Cannot read file')) {
        throw error;
      } else if (error.message.includes('timeout')) {
        throw new Error('File processing timed out. The file might be too large or complex. Try a smaller file.');
      } else if (error.message.includes('Rate limit')) {
        throw new Error('Too many requests. Please wait 30 seconds and try again.');
      } else if (error.message.includes('invalid JSON')) {
        throw error;
      } else {
        throw new Error('Failed to generate quiz from file. Please ensure the file contains clear, readable educational content.');
      }
    }
  }

  /**
   * ✅ NEW: Generate quiz from YouTube video link
   */
  async generateFromYouTube(videoUrl, questionCount = 6, difficulty = 'medium', description = '') {
    try {
      console.log('📺 Processing YouTube video:', videoUrl);

      // TODO: Implement YouTube transcript extraction
      // For now, return error message
      throw new Error('YouTube link support coming soon! Please use file upload or topic input for now.');

      // Future implementation would:
      // 1. Extract video ID from URL
      // 2. Use YouTube Transcript API to get captions
      // 3. Process transcript like file content
    } catch (error) {
      console.error('❌ YouTube processing error:', error.message);
      throw error;
    }
  }

  /**
   * ✅ NEW: Generate quiz from website link
   */
  async generateFromWebsite(websiteUrl, questionCount = 6, difficulty = 'medium', description = '') {
    try {
      console.log('🌐 Processing website:', websiteUrl);

      // TODO: Implement web scraping
      // For now, return error message
      throw new Error('Website link support coming soon! Please use file upload or topic input for now.');

      // Future implementation would:
      // 1. Use axios to fetch HTML
      // 2. Use cheerio to extract main content
      // 3. Clean and process like file content
    } catch (error) {
      console.error('❌ Website processing error:', error.message);
      throw error;
    }
  }

  /**
   * Extract JSON from AI response
   */
  extractJSON(text) {
    // Remove markdown code blocks
    let cleaned = text
      .replace(/```json\n?/gi, '')
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
      throw new Error('Invalid quiz format - expected array of questions');
    }
    if (questions.length === 0) {
      throw new Error('No questions were generated. Please try again.');
    }

    return questions.map((q, index) => {
      if (!q.questionText) {
        throw new Error(`Invalid question structure at position ${index + 1}`);
      }

      const questionType = q.questionType || 'multiple_choice';

      // ✅ Handle options per question type
      if (!Array.isArray(q.options)) q.options = [];

      if (questionType === 'fill_in_blank') {
        // fill_in_blank doesn't need options
        q.options = [];

      } else if (questionType === 'true_false') {
        q.options = ['True', 'False'];

      } else if (questionType === 'multiple_select') {
        // Keep options as-is, just clean prefixes
        q.options = q.options.map(opt => {
          if (typeof opt !== 'string') opt = String(opt);
          return opt.replace(/^[A-E][\)\.:\-\s]+/i, '').trim();
        });

      } else {
        // multiple_choice: enforce exactly 4 options
        const questionType = q.questionType || 'multiple_choice';
        if (questionType === 'multiple_choice' || questionType === 'true_false') {
          while (q.options.length < 4) q.options.push(`Option ${q.options.length + 1}`);
          if (q.options.length > 4) q.options = q.options.slice(0, 4);
        }
        if (q.options.length > 4) q.options = q.options.slice(0, 4);
        q.options = q.options.map(opt => {
          if (typeof opt !== 'string') opt = String(opt);
          return opt.replace(/^[A-D][\)\.:\-\s]+/i, '').trim();
        });
      }

      // ✅ Handle correctAnswer per question type
      let correctAnswer;

      if (questionType === 'fill_in_blank') {
        // Keep as string
        correctAnswer = String(q.correctAnswer || '').trim().toLowerCase();

      } else if (questionType === 'true_false') {
        // Convert to boolean or 0/1 index
        if (typeof q.correctAnswer === 'boolean') {
          correctAnswer = q.correctAnswer ? 0 : 1; // 0=True, 1=False
        } else if (typeof q.correctAnswer === 'string') {
          correctAnswer = q.correctAnswer.toLowerCase() === 'true' ? 0 : 1;
        } else {
          correctAnswer = 0;
        }

      } else if (questionType === 'multiple_select') {
        // Keep as array of numbers
        if (Array.isArray(q.correctAnswer)) {
          correctAnswer = q.correctAnswer
            .filter(v => typeof v === 'number' && v >= 0)
            .map(v => Math.floor(v));
        } else {
          correctAnswer = [0]; // fallback
        }

      } else {
        // multiple_choice: must be a number 0-3
        let correctIndex = 0;
        if (typeof q.correctAnswer === 'number') {
          correctIndex = q.correctAnswer;
        } else if (typeof q.correctAnswer === 'string') {
          const val = q.correctAnswer.trim();
          if (/^[0-3]$/.test(val)) {
            correctIndex = parseInt(val);
          } else if (/^[A-Da-d]$/.test(val)) {
            correctIndex = val.toUpperCase().charCodeAt(0) - 65;
          } else {
            const matchIndex = q.options.findIndex(opt =>
              opt.toLowerCase().trim() === val.toLowerCase().trim() ||
              opt.toLowerCase().includes(val.toLowerCase()) ||
              val.toLowerCase().includes(opt.toLowerCase())
            );
            correctIndex = matchIndex >= 0 ? matchIndex : 0;
          }
        } else if (Array.isArray(q.correctAnswer)) {
          const first = q.correctAnswer.find(v => typeof v === 'number' && v >= 0 && v <= 3);
          correctIndex = first !== undefined ? first : 0;
        }
        if (correctIndex < 0 || correctIndex > 3) correctIndex = 0;
        
      }

      return {
        questionText: q.questionText.trim(),
        questionType,
        options: q.options,
        correctAnswer, // 🔥 keep as-is (string/array/number)
        explanation: (q.explanation || 'This is the correct answer.').trim(),
        points: q.points || 10,
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
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Return only JSON quiz questions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 1500
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 60000
        }
      );

      return {
        success: true,
        message: 'Groq API connected successfully',
        model: this.model
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        model: this.model
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