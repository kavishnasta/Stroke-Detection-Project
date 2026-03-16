import React, { useMemo, useState } from 'react';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { LearnScreen } from './src/screens/LearnScreen';
import { FaceTestScreen } from './src/screens/FaceTestScreen';
import { ArmTestScreen } from './src/screens/ArmTestScreen';
import { SpeechTestScreen } from './src/screens/SpeechTestScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { combineOverallSeverity } from './src/flow/fastFlow';
import { requestCorePermissions } from './src/permissions/permissions';
import { FastSessionResult, Severity } from './src/types/landmarks';
import { saveResultToHistory } from './src/storage/historyStorage';

type Route = 'onboarding' | 'learn' | 'face' | 'arm' | 'speech' | 'results';

export default function App() {
  const [route, setRoute] = useState<Route>('onboarding');
  const [face, setFace] = useState<{ severity: Severity; flags: string[] }>({ severity: 'green', flags: [] });
  const [arm, setArm] = useState<{ severity: Severity; flagged: boolean }>({ severity: 'green', flagged: false });
  const [speech, setSpeech] = useState<{ severity: Severity; wer: number; pauses: number; durationSec: number }>({
    severity: 'green',
    wer: 0,
    pauses: 0,
    durationSec: 0,
  });

  const result: FastSessionResult = useMemo(() => {
    const overallSeverity = combineOverallSeverity(face.severity, arm.severity, speech.severity);
    return {
      timestamp: new Date().toISOString(),
      face,
      arm,
      speech,
      overallSeverity,
    };
  }, [face, arm, speech]);

  const startFastTest = async () => {
    const perms = await requestCorePermissions();
    if (!perms.camera || !perms.microphone) {
      setRoute('onboarding');
      return;
    }
    setFace({ severity: 'green', flags: [] });
    setArm({ severity: 'green', flagged: false });
    setSpeech({ severity: 'green', wer: 0, pauses: 0, durationSec: 0 });
    setRoute('face');
  };

  if (route === 'onboarding') {
    return <OnboardingScreen onStart={startFastTest} onLearn={() => setRoute('learn')} />;
  }

  if (route === 'learn') {
    return <LearnScreen onBack={() => setRoute('onboarding')} />;
  }

  if (route === 'face') {
    return (
      <FaceTestScreen
        onComplete={(severity, findings) => {
          setFace({ severity, flags: findings });
          setRoute('arm');
        }}
      />
    );
  }

  if (route === 'arm') {
    return (
      <ArmTestScreen
        onComplete={(severity, flagged) => {
          setArm({ severity, flagged });
          setRoute('speech');
        }}
      />
    );
  }

  if (route === 'speech') {
    return (
      <SpeechTestScreen
        onComplete={(severity, details) => {
          setSpeech({ severity, ...details });
          setRoute('results');
        }}
      />
    );
  }

  return (
    <ResultsScreen
      result={result}
      onSave={async () => {
        await saveResultToHistory(result);
      }}
      onRetake={startFastTest}
    />
  );
}
