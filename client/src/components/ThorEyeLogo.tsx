import { useEffect, useState, useRef } from 'react';
import { Eye } from 'lucide-react';

interface ThorEyeLogoProps {
  className?: string;
}

export default function ThorEyeLogo({ className = '' }: ThorEyeLogoProps) {
  const [animationComplete, setAnimationComplete] = useState(false);
  const eyeRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 1500); // Complete after 1.5 seconds for faster loading experience
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className={`thor-eye-container relative ${className}`}>
      <h2 className="text-3xl font-extrabold tracking-tight flex items-center">
        <span className="thor-text thor-eye-text bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-700 text-transparent bg-clip-text transition-all duration-700">
          Thor
        </span>
        <div 
          ref={eyeRef}
          className="eye-container relative mx-1 transform transition-all duration-500"
          style={{ animation: animationComplete ? 'eyeScan 4s infinite ease-in-out' : 'none' }}
        >
          <div 
            className="eye-outer absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-indigo-600" 
            style={{
              opacity: animationComplete ? 0.7 : 0.3,
              transform: `scale(${animationComplete ? 1.15 : 1})`,
              transition: 'all 0.5s ease-in-out',
              animation: animationComplete ? 'eyePulse 3s infinite ease-in-out' : 'none'
            }}
          />
          <Eye 
            className="h-7 w-7 relative z-10 text-white transition-all duration-500"
            style={{
              filter: animationComplete ? 'drop-shadow(0 0 4px rgba(79, 70, 229, 0.7))' : 'none',
              transition: 'all 0.3s ease-in-out'
            }}
            strokeWidth={2.5}
          />
        </div>
        <span className="eye-text thor-eye-text bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-700 text-transparent bg-clip-text transition-all duration-700">
          Eye
        </span>
      </h2>
      <style dangerouslySetInnerHTML={{ __html: `        
        .thor-eye-container:hover .thor-text {
          letter-spacing: 0.05em;
        }
        
        .thor-eye-container:hover .eye-text {
          letter-spacing: 0.05em;
        }
        
        .thor-eye-container:hover .eye-container {
          transform: scale(1.1) rotate(5deg);
        }
      `}} />
    </div>
  );
}
