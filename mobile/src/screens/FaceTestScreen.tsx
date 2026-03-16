import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Prompts, TrafficMessages } from '../constants/messages';
import { Severity } from '../types/landmarks';
import { BaseScreen } from '../ui/BaseScreen';
import { appStyles } from '../ui/theme';

type Props = {
  onComplete: (severity: Severity, findings: string[]) => void;
};

export function FaceTestScreen({ onComplete }: Props) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [faceSeverity, setFaceSeverity] = useState<Severity>('green');

  const phases = useMemo(
    () => [
      { label: 'Step 1 of 3: Face Check', time: '5-second calibration', prompt: Prompts.calibration },
      { label: 'Rest analysis', time: '5 seconds', prompt: Prompts.faceIntro },
      { label: 'Smile test', time: '10 seconds', prompt: 'Smile as wide as you can!' },
      { label: 'Eyebrow test', time: '10 seconds', prompt: 'Raise both eyebrows high!' },
      { label: 'Cheek test', time: '10 seconds', prompt: 'Puff out both cheeks!' },
    ],
    [],
  );

  const current = phases[phaseIndex];

  const next = () => {
    if (phaseIndex < phases.length - 1) {
      setPhaseIndex((p: number) => p + 1);
      return;
    }
    const findings =
      faceSeverity === 'green'
        ? []
        : ['One side of your mouth appears to be drooping.', "One eyebrow isn't raising as high as the other."];
    onComplete(faceSeverity, findings);
  };

  return (
    <BaseScreen title="Step 1 of 3: Face Check">
      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>{current.label}</Text>
        <Text style={appStyles.body}>{current.time}</Text>
        <Text style={appStyles.body}>{current.prompt}</Text>
      </View>

      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Live mesh status</Text>
        <Text style={appStyles.body}>Show real-time MediaPipe Face Mesh overlay here so users can confirm tracking.</Text>
      </View>

      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Face result preview</Text>
        <Text style={appStyles.body}>{TrafficMessages[faceSeverity as keyof typeof TrafficMessages]}</Text>
      </View>

      <TouchableOpacity style={appStyles.button} onPress={() => setFaceSeverity('green')}>
        <Text style={appStyles.buttonText}>Mark Simulated GREEN</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={() => setFaceSeverity('yellow')}>
        <Text style={appStyles.buttonText}>Mark Simulated YELLOW</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={() => setFaceSeverity('red')}>
        <Text style={appStyles.buttonText}>Mark Simulated RED</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={next}>
        <Text style={appStyles.buttonText}>{phaseIndex === phases.length - 1 ? '✓ Face check complete' : 'Next Phase'}</Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}
