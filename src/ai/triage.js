export const buildTriagePrompt = (inputs) => {
  return `Classify this patient's triage level based on:
- Breathing: ${inputs.breathing}
- Severe bleeding: ${inputs.severeBleeding}
- Conscious: ${inputs.conscious}
- Can move: ${inputs.canMove}
- Notes: ${inputs.description || 'None'}

Respond ONLY with the triage tag and one sentence reason.`;
};

export const parseTriageResponse = (response) => {
  const text = response.trim().toUpperCase();
  let tag = 'YELLOW';
  let reason = 'Patient needs assessment';

  const tagMatch = text.match(/\b(RED|BLACK|GREEN|YELLOW)\b/);
  if (tagMatch) {
    tag = tagMatch[1];
    const afterTag = text.substring(tagMatch.index + tagMatch[0].length).trim();
    reason = afterTag || getDefaultReason(tag);
  }

  return { tag, reason };
};

const getDefaultReason = (tag) => {
  const reasons = {
    RED: 'Immediate life threat',
    BLACK: 'Expectant care',
    GREEN: 'Delayed care needed',
    YELLOW: 'Urgent but stable',
  };
  return reasons[tag] || 'Patient needs assessment';
};