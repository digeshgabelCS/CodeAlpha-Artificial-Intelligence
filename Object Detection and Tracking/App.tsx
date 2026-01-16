import React, { useState } from 'react';
import ObjectDetectionSystem from './components/ObjectDetectionSystem';

const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col">
      {error && (
        <div className="absolute top-0 left-0 w-full bg-red-600 text-white p-2 text-center z-[100] font-mono text-sm">
          ERROR: {error}
          <button onClick={() => setError(null)} className="ml-4 underline">DISMISS</button>
        </div>
      )}
      <ObjectDetectionSystem onError={setError} />
    </div>
  );
};

export default App;