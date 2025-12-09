import React, { useState, useEffect } from 'react';
import { SnakeCanvas } from './components/SnakeCanvas';
import { WebcamOverlay } from './components/WebcamOverlay';
import { GameState, FingerPosition } from './types';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState("等待开始...");
  const [fingerPos, setFingerPos] = useState<FingerPosition>({ x: 0.5, y: 0.5, isActive: false });

  // Reset finger active status if no update for 2 seconds
  useEffect(() => {
    if (fingerPos.isActive) {
      const timer = setTimeout(() => {
        setFingerPos(prev => ({ ...prev, isActive: false }));
        setStatus("失去手指追踪...");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [fingerPos]);

  const handleStart = () => {
    setScore(0);
    setGameState(GameState.PLAYING);
    setStatus("正在连接 AI 视觉...");
  };

  const handleGameOver = () => {
    setGameState(GameState.GAME_OVER);
  };

  return (
    // Fixed inset-0 ensures full screen on mobile without address bar scroll issues
    <div className="fixed inset-0 overflow-hidden bg-slate-900 select-none touch-none">
      
      {/* Game Layer */}
      <SnakeCanvas 
        gameState={gameState}
        fingerPosition={fingerPos}
        onScoreUpdate={setScore}
        onGameOver={handleGameOver}
      />

      {/* Camera Layer */}
      <WebcamOverlay 
        isGameActive={gameState === GameState.PLAYING}
        onFingerMove={(pos) => {
            setFingerPos(pos);
            setStatus("追踪生效中");
        }}
        onStatusChange={setStatus}
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex justify-between items-start z-20">
        <div className="max-w-[60%]">
           <h1 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500 filter drop-shadow-sm">
             Gemini 手指贪吃蛇
           </h1>
           <p className="text-slate-400 text-xs md:text-sm mt-1">
             对着摄像头伸出<span className="text-white font-bold">食指</span>引导方向
           </p>
        </div>
        <div className="flex flex-col items-end">
            <div className="text-3xl md:text-4xl font-mono font-bold text-white drop-shadow-md">
                {score}
            </div>
            <div className="mt-2 px-2 py-1 md:px-3 bg-slate-800/80 rounded-full text-[10px] md:text-xs text-slate-300 border border-slate-700 backdrop-blur-sm">
                状态：<span className="text-green-400">{status}</span>
            </div>
        </div>
      </div>

      {/* Start Screen */}
      {gameState === GameState.IDLE && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30 backdrop-blur-sm p-4">
          <div className="text-center p-6 md:p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-sm md:max-w-md w-full">
            <div className="text-5xl md:text-6xl mb-4 animate-bounce">🐍👆</div>
            <h2 className="text-xl md:text-2xl font-bold mb-4">准备好了吗？</h2>
            <p className="text-slate-300 text-sm md:text-base mb-6 leading-relaxed">
              举起你的手，伸出<strong className="text-green-400">食指</strong>对着前置摄像头。
              <br/>
              Gemini AI 将实时追踪你的指尖来控制贪吃蛇！
            </p>
            <button 
              onClick={handleStart}
              className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold rounded-full transition-all transform hover:scale-105 shadow-lg active:scale-95"
            >
              开始游戏
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 z-30 backdrop-blur-md p-4">
           <div className="text-center p-8 bg-slate-800 rounded-2xl border border-red-500/30 shadow-2xl w-full max-w-sm">
            <h2 className="text-3xl md:text-4xl font-bold mb-2 text-white">游戏结束</h2>
            <p className="text-lg md:text-xl text-slate-300 mb-6">最终得分：{score}</p>
            <button 
              onClick={handleStart}
              className="w-full md:w-auto px-8 py-3 bg-white text-slate-900 font-bold rounded-full hover:bg-slate-200 transition-colors active:scale-95"
            >
              再玩一次
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;