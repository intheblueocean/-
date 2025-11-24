
import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Sparkles, ChevronLeft, ChevronRight, Wand2, Home, RefreshCw, Loader2, Gamepad2, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { AppState, StoryData, StoryPage } from './types';
import { processStoryText, generateIllustration } from './services/geminiService';
import { Button } from './components/Button';
import { PinyinCharacter } from './components/PinyinCharacter';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.INPUT);
  const [inputText, setInputText] = useState('');
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Game State
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);

  // Auto-generate image for the current page if missing
  useEffect(() => {
    if (appState === AppState.READING && storyData) {
      const page = storyData.pages[currentPageIndex];
      if (!page.imageData && !page.isGeneratingImage) {
        triggerImageGeneration(currentPageIndex, page.imagePrompt);
      }
      
      // Preload next page image
      const nextPage = storyData.pages[currentPageIndex + 1];
      if (nextPage && !nextPage.imageData && !nextPage.isGeneratingImage) {
        triggerImageGeneration(currentPageIndex + 1, nextPage.imagePrompt);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, currentPageIndex, storyData]);

  const triggerImageGeneration = useCallback(async (pageIndex: number, prompt: string) => {
    setStoryData(prev => {
      if (!prev) return null;
      const newPages = [...prev.pages];
      newPages[pageIndex] = { ...newPages[pageIndex], isGeneratingImage: true };
      return { ...prev, pages: newPages };
    });

    try {
      const imageUrl = await generateIllustration(prompt);
      setStoryData(prev => {
        if (!prev) return null;
        const newPages = [...prev.pages];
        newPages[pageIndex] = { 
          ...newPages[pageIndex], 
          imageData: imageUrl, 
          isGeneratingImage: false 
        };
        return { ...prev, pages: newPages };
      });
    } catch (err) {
      console.error("Image gen failed", err);
      // Don't fail the whole app, just stop the spinner
      setStoryData(prev => {
        if (!prev) return null;
        const newPages = [...prev.pages];
        newPages[pageIndex] = { ...newPages[pageIndex], isGeneratingImage: false };
        return { ...prev, pages: newPages };
      });
    }
  }, []);

  const handleCreateStory = async () => {
    if (!inputText.trim()) return;
    setAppState(AppState.PROCESSING);
    setErrorMsg('');

    try {
      const processed = await processStoryText(inputText);
      const pagesWithIds: StoryPage[] = processed.pages.map((p, i) => ({
        ...p,
        id: i,
        isGeneratingImage: false,
        imageData: undefined
      }));
      
      setStoryData({
        title: processed.title,
        pages: pagesWithIds,
        quiz: processed.quiz || []
      });
      setAppState(AppState.READING);
      setCurrentPageIndex(0);
    } catch (e: any) {
      console.error(e);
      let message = "哎呀！制作绘本时出了一点小问题。";
      
      if (e.message) {
        if (e.message.includes("Rpc failed")) {
           message = "网络连接错误，请检查网络后重试。";
        } else if (e.message.includes("429")) {
           message = "请求太多啦，请稍等一会再试。";
        } else {
           message = e.message;
        }
      } else if (typeof e === 'string') {
        message = e;
      }
      
      setErrorMsg(message);
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    setAppState(AppState.INPUT);
    setStoryData(null);
    setInputText('');
    setCurrentPageIndex(0);
    resetGame();
  };

  const resetGame = () => {
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setIsAnswerCorrect(null);
    setScore(0);
  };

  const startGame = () => {
    resetGame();
    setAppState(AppState.GAME);
  };

  const handleQuizAnswer = (option: string) => {
    if (selectedOption) return; // Prevent double click
    
    const correct = storyData?.quiz[currentQuizIndex].correctAnswer;
    setSelectedOption(option);
    const isCorrect = option === correct;
    setIsAnswerCorrect(isCorrect);
    
    if (isCorrect) {
      setScore(s => s + 1);
    }

    // Auto advance after short delay
    setTimeout(() => {
      if (currentQuizIndex < (storyData?.quiz.length || 0) - 1) {
        setCurrentQuizIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsAnswerCorrect(null);
      } else {
        // End of quiz
        setSelectedOption(null);
        setIsAnswerCorrect(null);
        setCurrentQuizIndex(prev => prev + 1); // Move to result screen
      }
    }, 2000);
  };

  // Views
  const renderInput = () => (
    <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col items-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full border-4 border-paper-dark">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-primary/10 p-4 rounded-full">
            <BookOpen className="w-12 h-12 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-center text-accent mb-2">拼音故事绘本</h1>
        <h2 className="text-lg text-gray-500 text-center mb-8">输入一个故事，把它变成魔法绘本！</h2>
        
        <textarea
          className="w-full h-48 p-4 rounded-xl border-2 border-green-100 bg-[#f0fdf4] focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none text-lg text-gray-700 mb-6 transition-all"
          placeholder="在这里粘贴故事内容（例如：龟兔赛跑）..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        
        <Button 
          onClick={handleCreateStory} 
          disabled={!inputText.trim()} 
          className="w-full text-lg py-4"
        >
          <Sparkles className="w-5 h-5" />
          开始制作魔法书
        </Button>
        
        <div className="mt-6 flex justify-center gap-2 text-sm text-gray-400">
          <span>Supported by Gemini AI</span>
        </div>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
        <div className="relative bg-white p-6 rounded-full shadow-lg">
          <Wand2 className="w-12 h-12 text-primary animate-pulse" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-accent mt-8 mb-2">正在施展魔法...</h2>
      <p className="text-gray-500 max-w-md">魔法精灵们正在标注拼音和绘制插画，请稍等哦！</p>
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="bg-red-50 p-6 rounded-full mb-6">
        <BookOpen className="w-12 h-12 text-red-400" />
      </div>
      <h2 className="text-2xl font-bold text-accent mb-2">糟糕！</h2>
      <p className="text-gray-500 mb-6 max-w-md px-4 py-2 bg-white rounded-lg border border-red-100 shadow-sm text-sm break-words">{errorMsg}</p>
      <Button onClick={resetApp} variant="secondary">再试一次</Button>
    </div>
  );

  const renderBook = () => {
    if (!storyData) return null;
    const page = storyData.pages[currentPageIndex];
    const isFirst = currentPageIndex === 0;
    const isLast = currentPageIndex === storyData.pages.length - 1;

    return (
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10 flex flex-col h-screen md:h-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={resetApp} className="!px-3">
            <Home className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg md:text-xl font-bold text-accent">{storyData.title}</h1>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
              第 {currentPageIndex + 1} 页 / 共 {storyData.pages.length} 页
            </p>
          </div>
          <div className="w-10"></div> 
        </div>

        {/* Book Content */}
        <div className="flex-1 bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col md:flex-row relative">
          
          {/* Image Side */}
          <div className="w-full md:w-1/2 bg-paper-dark h-64 md:h-auto min-h-[300px] relative overflow-hidden group">
            {page.imageData ? (
              <>
                <img 
                  src={page.imageData} 
                  alt="Story illustration" 
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerImageGeneration(currentPageIndex, page.imagePrompt);
                  }}
                  className="absolute top-4 right-4 bg-white/80 p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="重新生成图片"
                >
                   <RefreshCw className="w-4 h-4 text-gray-700" />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                <p className="text-sm font-medium">正在绘制插画...</p>
              </div>
            )}
          </div>

          {/* Text Side */}
          <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col">
            <div className="flex-1 flex flex-wrap content-start items-baseline leading-loose gap-y-4">
              {page.content.map((charData, idx) => (
                <PinyinCharacter key={`${currentPageIndex}-${idx}`} data={charData} />
              ))}
            </div>
            
            {/* Show Game Button on Last Page */}
            {isLast && (
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center animate-bounce">
                <Button onClick={startGame} className="bg-green-500 hover:bg-green-600 shadow-green-200">
                  <Gamepad2 className="w-5 h-5" />
                  玩个小游戏
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 px-4">
          <Button 
            onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
            disabled={isFirst}
            variant="secondary"
            className="w-40 whitespace-nowrap"
          >
            <ChevronLeft className="w-5 h-5" /> 上一页
          </Button>

          <Button 
            onClick={() => setCurrentPageIndex(p => Math.min(storyData.pages.length - 1, p + 1))}
            disabled={isLast}
            className="w-40 whitespace-nowrap"
          >
            下一页 <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  };

  const renderGame = () => {
    if (!storyData || !storyData.quiz) return null;

    // Game Over Screen
    if (currentQuizIndex >= storyData.quiz.length) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="bg-yellow-100 p-8 rounded-full mb-6 animate-pulse">
            <Trophy className="w-16 h-16 text-yellow-500" />
          </div>
          <h2 className="text-3xl font-bold text-accent mb-4">太棒了！</h2>
          <p className="text-xl text-gray-600 mb-8">
            你答对了 {score} / {storyData.quiz.length} 题
          </p>
          <div className="flex gap-4">
            <Button onClick={() => setAppState(AppState.READING)} variant="secondary">
              回到故事
            </Button>
            <Button onClick={startGame} className="bg-green-500 hover:bg-green-600">
              再玩一次
            </Button>
          </div>
        </div>
      );
    }

    const currentQ = storyData.quiz[currentQuizIndex];
    // Find the image from the related page
    const relatedPage = storyData.pages[currentQ.relatedPageIndex];
    const questionImage = relatedPage?.imageData;

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col min-h-screen">
         <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => setAppState(AppState.READING)}>
            <ChevronLeft className="w-5 h-5" /> 退出游戏
          </Button>
          <span className="text-lg font-bold text-accent">看图识字 ({currentQuizIndex + 1}/{storyData.quiz.length})</span>
          <div className="w-20"></div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row flex-1">
          {/* Image Area */}
          <div className="w-full md:w-1/2 bg-paper-dark h-64 md:h-auto min-h-[300px] relative">
            {questionImage ? (
              <img 
                src={questionImage} 
                alt="Quiz context" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                (图片未生成)
              </div>
            )}
          </div>

          {/* Question Area */}
          <div className="w-full md:w-1/2 p-8 flex flex-col justify-center bg-green-50/50">
            <h3 className="text-2xl font-bold text-accent mb-8 text-center">
              {currentQ.question}
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {currentQ.options.map((option, idx) => {
                let btnStyle = "bg-white hover:bg-green-100 border-2 border-green-100 text-lg py-4 text-accent";
                let icon = null;

                if (selectedOption === option) {
                   if (isAnswerCorrect) {
                     btnStyle = "bg-green-500 text-white border-green-500 hover:bg-green-500";
                     icon = <CheckCircle2 className="w-6 h-6 ml-2" />;
                   } else {
                     btnStyle = "bg-red-400 text-white border-red-400 hover:bg-red-400";
                     icon = <XCircle className="w-6 h-6 ml-2" />;
                   }
                } else if (selectedOption && option === currentQ.correctAnswer) {
                   // Reveal correct answer if wrong one picked
                   btnStyle = "bg-green-100 border-green-300 text-green-700";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleQuizAnswer(option)}
                    disabled={selectedOption !== null}
                    className={`rounded-2xl transition-all font-bold shadow-sm flex items-center justify-center ${btnStyle}`}
                  >
                    {option}
                    {icon}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#faeee7]">
      {appState === AppState.INPUT && renderInput()}
      {appState === AppState.PROCESSING && renderProcessing()}
      {appState === AppState.READING && renderBook()}
      {appState === AppState.GAME && renderGame()}
      {appState === AppState.ERROR && renderError()}
    </div>
  );
};

export default App;
