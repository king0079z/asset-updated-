import { useState } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus, Loader2, Calendar, ArrowRight, Brain, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AiSuggestion = {
  title: string;
  description: string;
  startDate: string | Date;
  endDate: string | Date | null;
  priority: string;
  status: string;
  assetId: string | null;
  aiSuggested: boolean;
  aiNotes: string;
};

interface AiSuggestionsProps {
  onAddSuggestion: (suggestion: AiSuggestion) => void;
}

export function AiSuggestions({ onAddSuggestion }: AiSuggestionsProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);

  const generateSuggestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/planner/ai-suggestions');
      
      if (!response.ok) {
        throw new Error('Failed to generate suggestions');
      }
      
      const data = await response.json();
      setSuggestions(data);
      setGeneratedCount(prev => prev + 1);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      setError(t('error_generating_suggestions'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuggestion = (suggestion: AiSuggestion) => {
    onAddSuggestion(suggestion);
    // Remove the suggestion from the list
    setSuggestions(suggestions.filter(s => s.title !== suggestion.title));
  };

  // Function to get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/70';
      case 'MEDIUM':
        return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/70';
      case 'HIGH':
        return 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-900/70';
      case 'URGENT':
        return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/70';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/70';
    }
  };

  return (
    <Card className="border-indigo-100 dark:border-indigo-800/50 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b border-indigo-100 dark:border-indigo-800/50">
        <CardTitle className="flex items-center">
          <Brain className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
          {t('ai_suggestions')}
        </CardTitle>
        <CardDescription>
          {t('generate_suggestions')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-12 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
            <p className="text-indigo-700 dark:text-indigo-300 font-medium">{t('generating_suggestions')}</p>
            <p className="text-indigo-500 dark:text-indigo-400 text-sm mt-1">{t('please_wait')}</p>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50">
            <AlertDescription className="text-red-700 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        ) : suggestions.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-300 flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                {t('ai_generated_tasks')}
              </h3>
              <Badge className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200">
                {suggestions.length} {t('suggestions')}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={index} 
                  className="p-4 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/30 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                        {suggestion.title}
                        <Badge variant="outline" className="ml-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/70">
                          {t('ai_suggested')}
                        </Badge>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{suggestion.description}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 italic">{suggestion.aiNotes}</p>
                    </div>
                    <Badge className={getPriorityColor(suggestion.priority)}>
                      {t(`priority_${suggestion.priority.toLowerCase()}`)}
                    </Badge>
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex flex-wrap gap-4">
                      <p className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-indigo-500 dark:text-indigo-400" />
                        {t('start_date')}: {format(new Date(suggestion.startDate), 'PPP')}
                      </p>
                      {suggestion.endDate && (
                        <p className="flex items-center">
                          <ArrowRight className="h-3 w-3 mr-1 text-indigo-500 dark:text-indigo-400" />
                          {t('end_date')}: {format(new Date(suggestion.endDate), 'PPP')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-end">
                    <Button 
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600"
                      onClick={() => handleAddSuggestion(suggestion)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('add_task')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
            <Lightbulb className="h-12 w-12 text-amber-400 dark:text-amber-300 mx-auto mb-3" />
            <p className="text-gray-700 dark:text-gray-300 font-medium">{t('no_suggestions_yet')}</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-md mx-auto">
              {generatedCount === 0 
                ? t('click_generate_to_start') 
                : t('all_suggestions_added')}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-t border-indigo-100 dark:border-indigo-800/50 p-4">
        <Button 
          variant="default" 
          onClick={generateSuggestions}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Lightbulb className="h-4 w-4 mr-2 text-amber-300" />
          )}
          {loading ? t('generating') : t('generate_suggestions')}
        </Button>
      </CardFooter>
    </Card>
  );
}