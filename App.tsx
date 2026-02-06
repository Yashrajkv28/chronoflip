import React, { useEffect, useState } from 'react';
import FlipClockTimer from './components/FlipClockTimer';
import HelpModal from './components/HelpModal';

const App: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('chronoflip-darkmode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('chronoflip-darkmode', String(darkMode));
    const body = document.body;
    if (darkMode) {
      document.documentElement.classList.add('dark');
      body.classList.remove('light-mesh-bg');
      body.classList.add('mesh-bg');
    } else {
      document.documentElement.classList.remove('dark');
      body.classList.remove('mesh-bg');
      body.classList.add('light-mesh-bg');
    }
  }, [darkMode]);

  return (
    <div className="relative text-gray-900 dark:text-white min-h-screen">
      {/* Dark Mode Toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-6 right-6 z-50 p-3 rounded-full 
                   bg-white/20 dark:bg-black/20 backdrop-blur-md
                   border border-white/20 dark:border-white/10
                   shadow-lg hover:scale-110 transition-all duration-200"
      >
        {darkMode ? (
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </button>

      {/* Help Button */}
      <button
        type="button"
        onClick={() => setShowHelp(true)}
        title="Help & Keyboard Shortcuts"
        aria-label="Open help and keyboard shortcuts"
        className="fixed bottom-6 left-6 z-50 p-3 rounded-full
                   bg-white/20 dark:bg-black/20 backdrop-blur-md
                   border border-white/20 dark:border-white/10
                   shadow-lg hover:scale-110 transition-all duration-200"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
        </svg>
      </button>

      <FlipClockTimer />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};

export default App;