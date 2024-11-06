// api/analyze-resume/index.js
const { BlobServiceClient } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');
const textract = require('textract');
const multipart = require('parse-multipart');

// Initialize Azure clients
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient('resumes');

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});
const database = cosmosClient.database('ResumeDB');
const container = database.container('Analyses');

module.exports = async function (context, req) {
  try {
    // Parse multipart form data
    const bodyBuffer = Buffer.from(req.body);
    const boundary = multipart.getBoundary(req.headers['content-type']);
    const parts = multipart.Parse(bodyBuffer, boundary);
    const resumeFile = parts[0];

    // Extract text content
    const text = await extractText(resumeFile.data, resumeFile.type);
    
    // Analyze the resume
    const analysis = await analyzeResume(text);

    // Save to blob storage
    const blobName = `${Date.now()}-${resumeFile.filename}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(resumeFile.data, resumeFile.data.length);

    // Save analysis to Cosmos DB
    const record = {
      id: blobName,
      fileName: resumeFile.filename,
      blobUrl: blockBlobClient.url,
      analysis,
      timestamp: new Date().toISOString()
    };
    
    await container.items.create(record);

    context.res = {
      status: 200,
      body: analysis
    };
  } catch (error) {
    context.log.error('Error processing resume:', error);
    context.res = {
      status: 500,
      body: {
        error: 'Failed to process resume',
        details: error.message
      }
    };
  }
};

function extractText(buffer, mimeType) {
  return new Promise((resolve, reject) => {
    textract.fromBufferWithMime(mimeType, buffer, (error, text) => {
      if (error) reject(error);
      else resolve(text);
    });
  });
}

async function analyzeResume(text) {
  const sections = {
    contact: /(?:email|phone|address):/i,
    education: /(?:education|university|college|degree):/i,
    experience: /(?:experience|work|employment):/i,
    skills: /(?:skills|technologies|programming|languages):/i,
    projects: /(?:projects|portfolio):/i,
    achievements: /(?:achievements|awards|accomplishments):/i
  };

  const scores = {};
  const findings = [];
  const recommendations = [];

  // Analyze each section
  for (const [section, pattern] of Object.entries(sections)) {
    const hasSection = pattern.test(text);
    const sectionContent = text.split(pattern)[1]?.split(/\n\n/)[0] || '';
    const wordCount = sectionContent.split(/\s+/).length;
    
    scores[section] = calculateSectionScore(hasSection, wordCount);
    
    if (!hasSection) {
      recommendations.push(`Add a ${section} section to your resume`);
    } else if (wordCount < 20) {
      recommendations.push(`Expand your ${section} section with more details`);
    } else {
      findings.push(`Strong ${section} section with ${wordCount} words`);
    }
  }

  // Analyze overall content
  const totalWords = text.split(/\s+/).length;
  if (totalWords < 200) {
    recommendations.push('Your resume seems too brief. Add more detailed information.');
  } else if (totalWords > 1000) {
    recommendations.push('Consider condensing your resume to be more concise.');
  }

  // Check for action verbs
  const actionVerbs = ['led', 'developed', 'created', 'managed', 'implemented', 'designed', 'achieved'];
  const actionVerbCount = actionVerbs.reduce((count, verb) => {
    const matches = text.toLowerCase().match(new RegExp(verb, 'g')) || [];
    return count + matches.length;
  }, 0);

  if (actionVerbCount < 5) {
    recommendations.push('Use more action verbs to describe your achievements');
  } else {
    findings.push(`Good use of action verbs (${actionVerbCount} found)`);
  }

  // Calculate overall score
  const overallScore = Math.round(
    Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length
  );

  return {
    overallScore,
    scores,
    findings,
    recommendations
  };
}

function calculateSectionScore(exists, wordCount) {
  if (!exists) return 0;
  if (wordCount < 20) return 40;
  if (wordCount < 50) return 70;
  if (wordCount < 100) return 90;
  return 100;
}

// api/get-history/index.js
module.exports = async function (context, req) {