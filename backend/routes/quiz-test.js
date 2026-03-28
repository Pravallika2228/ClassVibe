const express = require('express');
const router = express.Router();
const { generator } = require('../services/aiQuizGenerator');

// TEST ROUTE - NO AUTH (remove after testing)
router.post('/test-generate', async (req, res) => {
  try {
    const { topic, questionCount } = req.body;
    
    console.log('🧪 Testing Gemini API with topic:', topic);
    
    const questions = await generator.generateFromText(topic, questionCount || 5);
    
    console.log('✅ Gemini API SUCCESS!');
    
    res.json({
      success: true,
      message: 'Gemini API is working!',
      questions
    });
    
  } catch (error) {
    console.error('❌ Gemini API ERROR:', error.message);
    res.status(500).json({ 
      error: 'Gemini API failed',
      details: error.message 
    });
  }
});

module.exports = router;