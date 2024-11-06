import React, { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Upload, CheckCircle, AlertCircle, Eye, Save, Trash2, FileText, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FilePreview = ({ file }) => {
  const [content, setContent] = useState(null);

  React.useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setContent(reader.result);
      };
      if (file.type === 'application/pdf') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }
  }, [file]);

  if (!file) return null;

  if (file.type === 'application/pdf') {
    return (
      <iframe
        src={content}
        className="w-full h-[600px] border rounded"
        title="PDF Preview"
      />
    );
  }

  if (file.type.includes('image/')) {
    return (
      <img
        src={content}
        alt="Resume Preview"
        className="max-w-full h-auto border rounded"
      />
    );
  }

  return (
    <pre className="p-4 bg-gray-50 rounded overflow-auto max-h-[600px] text-sm">
      {content}
    </pre>
  );
};

const AnalysisChart = ({ data }) => {
  const chartData = Object.entries(data.scores).map(([category, value]) => ({
    name: category,
    score: value
  }));

  return (
    <div className="mt-6">
      <h4 className="font-medium mb-4 flex items-center">
        <BarChart2 className="w-5 h-5 mr-2" />
        Score Breakdown
      </h4>
      <LineChart width={500} height={300} data={chartData} className="mx-auto">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="score" stroke="#3b82f6" />
      </LineChart>
    </div>
  );
};

const ResumeAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAnalysis(null);
      setError(null);
    }
  };

  const analyzeResume = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await fetch('/api/analyze-resume', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      setAnalysis(result);
      
      // Add to history
      setHistory(prev => [
        {
          id: Date.now(),
          fileName: file.name,
          timestamp: new Date().toISOString(),
          analysis: result
        },
        ...prev
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [file]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Upload and Analysis */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Resume Analyzer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Upload Section */}
                <div className="flex flex-col items-center p-6 border-2 border-dashed rounded-lg border-gray-300 hover:border-gray-400">
                  <Upload className="w-12 h-12 text-gray-400" />
                  <label className="mt-4 cursor-pointer">
                    <span className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                      Select Resume
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />
                  </label>
                  {file && (
                    <div className="mt-2 text-sm text-gray-600">
                      <FileText className="w-4 h-4 inline mr-1" />
                      {file.name}
                    </div>
                  )}
                </div>

                <button
                  onClick={analyzeResume}
                  disabled={!file || loading}
                  className="w-full py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                >
                  {loading ? 'Analyzing...' : 'Analyze Resume'}
                </button>

                {error && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-md">
                    {error}
                  </div>
                )}

                {/* Analysis Results */}
                {analysis && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Analysis Results</h3>
                      <span className="flex items-center">
                        {analysis.overallScore >= 70 ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                        )}
                        Overall Score: {analysis.overallScore}/100
                      </span>
                    </div>
                    
                    <AnalysisChart data={analysis} />

                    <div className="mt-6">
                      <h4 className="font-medium mb-2">Key Findings:</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {analysis.findings.map((finding, index) => (
                          <li key={index} className="text-gray-700">{finding}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Recommendations:</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {analysis.recommendations.map((rec, index) => (
                          <li key={index} className="text-gray-700">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview and History */}
        <div className="space-y-6">
          {/* Preview Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Resume Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg bg-gray-50">
                {file ? (
                  <FilePreview file={file} />
                ) : (
                  <div className="h-[600px] flex items-center justify-center text-gray-400">
                    No file selected
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* History Card */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">Analysis History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-medium">{item.fileName}</h4>
                        <p className="text-sm text-gray-600">
                          Score: {item.analysis.overallScore}/100
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setHistory(prev => 
                          prev.filter(h => h.id !== item.id)
                        )}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalyzer;
