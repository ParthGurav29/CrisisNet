const OFFLINE_RESPONSES = {
  choking: `CHOKING — ACT NOW:
1. Give 5 back blows with firm upward thrusts against the person's back
2. Follow with 5 abdominal thrusts (Heimlich maneuver) if no improvement
3. Call emergency services immediately
4. Keep the person upright and calm`,

  cpr: `CPR — ACT NOW:
1. Call emergency services first (or have someone else call)
2. Position yourself behind the victim
3. Place heels of one hand on center of chest, other hand on top
4. Push hard and fast: 100-120 compressions per minute
5. Allow full chest recoil between compressions
6. Continue until professional help arrives or person shows signs of life`,

  cardiac: `CARDIAC EMERGENCY — ACT NOW:
1. Call emergency services immediately
2. Have person stop activity and rest
3. Give aspirin if not allergic (4-8 tablets)
4. Keep person calm and quiet
5. Monitor breathing and consciousness
6. Be ready for CPR if needed`,

  heart: `HEART EMERGENCY — ACT NOW:
1. Call emergency services immediately
2. Have person stop activity and rest
3. Give aspirin if not allergic (4-8 tablets)
4. Keep person calm and quiet
5. Monitor breathing and consciousness
6. Be ready for CPR if needed`,

  breathing: `BREATHING EMERGENCY — ACT NOW:
1. Check if person is conscious and breathing normally
2. If not breathing, call emergency services immediately
3. Begin rescue breathing: 30 breaths per minute
4. If trained, provide 30 chest compressions followed by 2 breaths (CPR)
5. Continue until professional help arrives
6. Keep the person calm and still`,

  bleeding: `BLEEDING — ACT NOW:
1. Apply direct pressure with clean cloth or gauze over wound
2. Keep pressure constant - do not lift to check
3. If blood soaks through, add more layers underneath
4. Elevate injured area above heart if possible
5. Apply tourniquet only if direct pressure fails and bleeding is severe
6. Call emergency services for serious bleeding`,

  burn: `BURN — ACT NOW:
1. Cool the burn immediately with clean water for 10-20 minutes
2. Remove jewelry or tight items near the burn
3. Do not apply ice, butter, or oils
4. Cover with clean, dry cloth
5. Seek medical attention for burns larger than 3 inches
6. Call emergency services for severe burns`,

  fracture: `FRACTURE — ACT NOW:
1. Do not move the person unless in immediate danger
2. Immobilize the injured limb above and below the fracture
3. Control bleeding with direct pressure
4. Splint with rigid materials (boards, sticks, etc.)
5. Seek medical attention immediately
6. Call emergency services if transportation is needed`,

  seizure: `SEIZURE — ACT NOW:
1. Do not restrain the person
2. Place something soft under head
3. Clear area of sharp objects
4. Time the seizure - call if >5 minutes
5. Do not put anything in mouth
6. Roll onto side to keep airway clear`,

  stroke: `STROKE — ACT NOW:
1. Call emergency services immediately
2. Remember FAST: Face drooping, Arm weakness, Speech difficulty
3. Time the symptoms - note when they started
4. Keep person still and comfortable
5. Do not give food or drink
6. Lower blood pressure with leg elevation if possible`,

  shock: `SHOCK — ACT NOW:
1. Call emergency services immediately
2. Keep person calm and lying down
3. Elevate legs 12 inches if no spine injury suspected
4. Cover with blankets to prevent heat loss
5. Monitor breathing and pulse
6. Do not give food, water, or medications`,

  allergic: `ALLERGIC REACTION — ACT NOW:
1. Call emergency services if severe
2. Administer epinephrine if available (EpiPen)
3. Remove source of allergen if visible
4. Keep person calm and at rest
5. Monitor breathing and circulation
6. Second reaction can be more severe - watch for 2+ hours`,

  unconscious: `UNCONSCIOUS PERSON — ACT NOW:
1. Check if person is breathing normally
2. Call emergency services immediately
3. Place person in recovery position if breathing
4. Monitor airway and breathing continuously
5. Do not leave person alone
6. Begin CPR if not breathing`,

  drowning: `DROWNING — ACT NOW:
1. Remove person from water immediately
2. Place head back and clear airway
3. Look for breathing - if not breathing, begin CPR
4. Start with 2 rescue breaths
5. Follow with 30 chest compressions
6. Continue until breathing normally or help arrives`,

  poisoning: `POISONING — ACT NOW:
1. Call Poison Control or emergency services
2. Do not induce vomiting unless directed
3. Have poison container ready
4. Remove contaminated clothing
5. Wash skin with soap and water
6. Follow medical instructions exactly`,

  earthquake: `EARTHQUAKE:
1. DROP to the ground
2. COVER under a sturdy table or desk
3. HOLD ON until shaking stops
4. Stay indoors until shaking stops completely
5. Then evacuate building safely
6. Once outside, stay away from buildings and power lines`,

  flood: `FLOOD:
1. Move to higher ground immediately
2. Do not walk or drive through flood waters
3. Turn off electricity at the main switch
4. Disconnect gas lines if safe to do so
5. Stay away from windows and walls that may collapse
6. Call emergency services if trapped`,

  fire: `FIRE:
1. Get low and go under smoke
2. Feel your way along walls using doorknobs
3. Crawl to exit - fresh air near floor
4. Never use elevators during fire
5. Once outside, stay at least 500 feet from building
6. Call emergency services from safe location`,

  trapped: `TRAPPED PERSON — ACT NOW:
1. Assess the situation safely from a distance first
2. Call emergency services immediately
3. Do not attempt rescue if it puts you at risk
4. Provide communication if possible
5. Keep the person calm and still
6. Monitor for signs of shock or injury`,

  cyclone: `CYCLONE:
1. Stay indoors and away from windows
2. Go to a windowless interior room or basement
3. Protect head and neck with makeshift padding
4. If no shelter, cover with thick blankets
5. Stay away from doors and outside walls
6. After cyclone, watch for flooding and downed power lines`,

  water: `WATER EMERGENCY:
1. Move to higher ground immediately
2. Do not walk or drive through moving water
3. Turn off electricity and gas if safe
4. Remove jewelry and heavy items
5. Seek shelter on higher floors
6. Call emergency services if trapped`,

  shelter: `SHELTER IN PLACE:
1. Stay where you are - do not evacuate
2. Lock doors and secure windows
3. Turn off lights and electronics
4. Listen for official instructions
5. Stay away from windows and doors
6. Have emergency supplies ready`,

  lost: `LOST PERSON — ACT NOW:
1. Stay in one place if safe to do so
2. Call out clearly and loudly
3. Signal for help with flashlight or mirror
4. Look for high ground or visible landmarks
5. Conserve energy and stay hydrated
6. Call emergency services if no response`,

  hypothermia: `HYPOTHERMIA:
1. Move person to warm, dry environment
2. Remove wet clothing
3. Wrap in warm blankets
4. Give warm (not hot) fluids if conscious
5. Share body heat if necessary
6. Call emergency services for severe cases`,

  heatstroke: `HEATSTROKE:
1. Move person to cool, shaded area
2. Remove excess clothing
3. Apply cold water to skin and fan
4. Give cool water if conscious
5. Call emergency services immediately
6. Monitor for collapse or unconsciousness`,
};

export const getEmergencyResponse = (prompt) => {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [key, response] of Object.entries(OFFLINE_RESPONSES)) {
    if (lowerPrompt.includes(key)) {
      return response;
    }
  }
  
  const generalKeywords = {
    help: "EMERGENCY HELP:\n1. Call emergency services (911)\n2. Stay on the line for instructions\n3. Provide your exact location\n4. Follow operator guidance",
    emergency: "EMERGENCY:\n1. Call emergency services immediately\n2. Describe the situation clearly\n3. Follow dispatcher instructions\n4. Provide your location",
    medical: "MEDICAL EMERGENCY:\n1. Call emergency services\n2. Stay with the person\n3. Keep them calm and comfortable\n4. Do not give food/drink if unconscious",
    injury: "INJURY ASSESSMENT:\n1. Check for severe bleeding\n2. Immobilize broken limbs\n3. Keep person still and calm\n4. Seek medical attention",
    safe: "SAFETY FIRST:\n1. Ensure your own safety first\n2. Call emergency services if needed\n3. Follow established protocols\n4. Document and report the incident",
    first: "FIRST AID:\n1. Assess safety of environment\n2. Check responsiveness\n3. Call for help if needed\n4. Provide appropriate care",
  };
  
  for (const [keyword, response] of Object.entries(generalKeywords)) {
    if (lowerPrompt.includes(keyword)) {
      return response;
    }
  }
  
  return "CRISISNET OFFLINE MODE:\n\nThis is a pre-loaded emergency response system.\n\nAvailable emergency topics:\n- Choking, CPR, Cardiac/Heart, Breathing\n- Bleeding, Burn, Fracture, Seizure, Stroke\n- Shock, Allergic reaction, Unconscious, Drowning\n- Poisoning, Earthquake, Flood, Fire, Trapped\n- Cyclone, Water emergency, Shelter, Lost person\n- Hypothermia, Heatstroke\n\nType specific keywords for immediate guidance.\n\nFor life-threatening emergencies, call local emergency services.";
};