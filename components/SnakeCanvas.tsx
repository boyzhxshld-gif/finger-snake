import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Point, SnakeSegment, FingerPosition } from '../types';

interface SnakeCanvasProps {
  gameState: GameState;
  fingerPosition: FingerPosition;
  onScoreUpdate: (score: number) => void;
  onGameOver: () => void;
}

const GRID_SIZE = 20;
const SNAKE_SPEED = 3; // Pixels per frame
const TURN_RATE = 0.15; // How fast it turns towards target

export const SnakeCanvas: React.FC<SnakeCanvasProps> = ({ 
  gameState, 
  fingerPosition, 
  onScoreUpdate, 
  onGameOver 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs (for loop performance)
  const snakeRef = useRef<SnakeSegment[]>([]);
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const directionRef = useRef<Point>({ x: 1, y: 0 }); // Normalized vector
  const scoreRef = useRef<number>(0);
  const wanderTargetRef = useRef<Point | null>(null);

  const initGame = useCallback((width: number, height: number) => {
    // Start in middle
    const startX = width / 2;
    const startY = height / 2;
    snakeRef.current = [];
    for (let i = 0; i < 10; i++) {
      snakeRef.current.push({ x: startX - i * (GRID_SIZE / 2), y: startY, id: i });
    }
    directionRef.current = { x: 1, y: 0 };
    scoreRef.current = 0;
    onScoreUpdate(0);
    spawnFood(width, height);
  }, [onScoreUpdate]);

  const spawnFood = (width: number, height: number) => {
    foodRef.current = {
      x: Math.random() * (width - 40) + 20,
      y: Math.random() * (height - 40) + 20
    };
  };

  const update = useCallback((width: number, height: number) => {
    if (gameState !== GameState.PLAYING) return;

    const head = snakeRef.current[0];
    let targetX = head.x;
    let targetY = head.y;

    // AI Finger Tracking Logic
    if (fingerPosition.isActive) {
      targetX = fingerPosition.x * width;
      targetY = fingerPosition.y * height;
    } else {
      // Random Wandering Logic
      if (!wanderTargetRef.current || Math.random() < 0.02) {
        wanderTargetRef.current = {
            x: Math.random() * width,
            y: Math.random() * height
        };
      }
      targetX = wanderTargetRef.current.x;
      targetY = wanderTargetRef.current.y;
    }

    // Calculate desired direction
    const dx = targetX - head.x;
    const dy = targetY - head.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) { // Only move if not at target
      const desiredDirX = dx / dist;
      const desiredDirY = dy / dist;

      // Smooth turn
      directionRef.current.x += (desiredDirX - directionRef.current.x) * TURN_RATE;
      directionRef.current.y += (desiredDirY - directionRef.current.y) * TURN_RATE;
      
      // Normalize
      const dirLen = Math.sqrt(directionRef.current.x ** 2 + directionRef.current.y ** 2);
      directionRef.current.x /= dirLen;
      directionRef.current.y /= dirLen;

      // Move Head
      const newHead = {
        x: head.x + directionRef.current.x * SNAKE_SPEED,
        y: head.y + directionRef.current.y * SNAKE_SPEED,
        id: Date.now()
      };

      // Collision with Walls (Wrap around or Bounce? Let's Wrap for fluid gameplay)
      if (newHead.x < 0) newHead.x = width;
      if (newHead.x > width) newHead.x = 0;
      if (newHead.y < 0) newHead.y = height;
      if (newHead.y > height) newHead.y = 0;

      // Move Body (Inverse Kinematics-ish or just follow trail)
      // Standard snake: Pop tail, unshift head.
      // Smooth snake: We keep segments at fixed distances.
      
      const newSnake = [newHead];
      let prev = newHead;
      
      for (let i = 1; i < snakeRef.current.length; i++) {
        const curr = snakeRef.current[i];
        const segDx = prev.x - curr.x;
        const segDy = prev.y - curr.y;
        const segDist = Math.sqrt(segDx * segDx + segDy * segDy);
        const segmentSpacing = 10;

        if (segDist > segmentSpacing) {
           const factor = (segDist - segmentSpacing) / segDist;
           newSnake.push({
             x: curr.x + segDx * factor,
             y: curr.y + segDy * factor,
             id: curr.id
           });
        } else {
            newSnake.push(curr);
        }
        prev = newSnake[i];
      }
      snakeRef.current = newSnake;
    }

    // Collision with Food
    const foodDx = head.x - foodRef.current.x;
    const foodDy = head.y - foodRef.current.y;
    if (Math.sqrt(foodDx * foodDx + foodDy * foodDy) < 20) {
      scoreRef.current += 10;
      onScoreUpdate(scoreRef.current);
      // Grow
      const tail = snakeRef.current[snakeRef.current.length - 1];
      for(let k=0; k<5; k++) { // Grow by 5 segments for smooth look
        snakeRef.current.push({ ...tail }); 
      }
      spawnFood(width, height);
    }

  }, [gameState, fingerPosition, onScoreUpdate]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    // Draw Grid (Subtle)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Draw Food
    ctx.fillStyle = '#facc15'; // Yellow-400
    ctx.beginPath();
    ctx.arc(foodRef.current.x, foodRef.current.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#facc15';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Snake
    if (snakeRef.current.length > 0) {
      // Draw Body
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#4ade80'; // Green-400
      ctx.beginPath();
      ctx.moveTo(snakeRef.current[0].x, snakeRef.current[0].y);
      for (let i = 1; i < snakeRef.current.length; i++) {
        ctx.lineTo(snakeRef.current[i].x, snakeRef.current[i].y);
      }
      ctx.stroke();

      // Draw Head
      const head = snakeRef.current[0];
      ctx.fillStyle = '#ecfccb'; // Lime-100
      ctx.beginPath();
      ctx.arc(head.x, head.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Finger Target (Debug/Feedback)
    if (fingerPosition.isActive) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fingerPosition.x * width, fingerPosition.y * height, 20, 0, Math.PI * 2);
        ctx.stroke();
    }

  }, [fingerPosition]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Re-spawn food if outside bounds
        if (foodRef.current.x > canvas.width || foodRef.current.y > canvas.height) {
            spawnFood(canvas.width, canvas.height);
        }
    });
    resizeObserver.observe(document.body);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Main Loop
    const loop = () => {
        update(canvas.width, canvas.height);
        draw(ctx, canvas.width, canvas.height);
        requestRef.current = requestAnimationFrame(loop);
    };

    // Initial setup if empty
    if (snakeRef.current.length === 0) {
        initGame(canvas.width, canvas.height);
    }

    requestRef.current = requestAnimationFrame(loop);

    return () => {
        cancelAnimationFrame(requestRef.current);
        resizeObserver.disconnect();
    };
  }, [gameState, draw, update, initGame]);

  // Reset game trigger
  useEffect(() => {
    if (gameState === GameState.PLAYING && snakeRef.current.length === 0 && canvasRef.current) {
         initGame(canvasRef.current.width, canvasRef.current.height);
    }
  }, [gameState, initGame]);


  return <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full z-0" />;
};