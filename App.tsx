
import React, { useState, useEffect, useMemo } from 'react';
import { UserState, AppView, DailyRecoveryPlan, SymptomCheck, Meal } from './types';
import { STORAGE_KEY, SYMPTOMS, DIETARY_OPTIONS } from './constants';
import { generateSaanviGuidance } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<AppView | 'ONBOARDING_FORM'>('CHECKIN');
  const [user, setUser] = useState<UserState | null>(null);
  const [plan, setPlan] = useState<DailyRecoveryPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState<SymptomCheck>({ physical: [], emotional: [], lactation: [] });
  
  // State for meal selection on the Plan screen
  const [selectedMealIndices, setSelectedMealIndices] = useState<Set<number>>(new Set());

  // Onboarding Step State
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempUser, setTempUser] = useState<UserState>({
    name: '',
    birthDate: new Date().toISOString().split('T')[0],
    deliveryType: 'Vaginal',
    optedIntoFood: true,
    preferences: ["No preference"]
  });

  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setUser(JSON.parse(saved));
      setView('CHECKIN');
    } else {
      setView('ONBOARDING');
    }
  }, []);

  // Calculate Days Postpartum and Recovery Stage
  const recoveryInfo = useMemo(() => {
    if (!user) return { days: 0, stage: '' };
    const birthDate = new Date(user.birthDate);
    const now = new Date();
    const days = Math.max(0, Math.floor((now.getTime() - birthDate.getTime()) / 86400000));
    
    let stage = '';
    if (days <= 42) stage = 'The Sacred Window (Initial Healing)';
    else if (days <= 90) stage = 'Strengthening & Transition';
    else if (days <= 180) stage = 'Deep Restoration';
    else stage = 'Thriving & Integration';

    return { days, stage };
  }, [user]);

  // Validate date whenever it changes
  useEffect(() => {
    const selectedDate = new Date(tempUser.birthDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - selectedDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const diffMonths = diffDays / 30.44;

    if (selectedDate > today) {
      setDateError("The birth date cannot be in the future.");
    } else if (diffMonths > 12) {
      setDateError("Saanvi currently supports the first year postpartum (0-12 months).");
    } else {
      setDateError(null);
    }
  }, [tempUser.birthDate]);

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await generateSaanviGuidance(user, check);
      setPlan(result);
      // Preselect all meals with a safety check
      const mealIndices = result.meals ? result.meals.map((_, i) => i) : [];
      setSelectedMealIndices(new Set(mealIndices));
      setView('PLAN');
    } catch (e) {
      console.error("Check-in handler error:", e);
      alert("Saanvi is taking a moment. Let's try your check-in once more.");
      setView('CHECKIN');
    } finally {
      // Ensure loader is always cleared
      setLoading(false);
    }
  };

  const finishOnboarding = () => {
    const finalUser = { ...tempUser };
    setUser(finalUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalUser));
    setView('CHECKIN');
  };

  const togglePreference = (pref: string) => {
    const current = new Set(tempUser.preferences);
    if (pref === "No preference") {
      setTempUser({...tempUser, preferences: ["No preference"]});
      return;
    }
    current.delete("No preference");
    if (current.has(pref)) {
      current.delete(pref);
      if (current.size === 0) current.add("No preference");
    } else {
      current.add(pref);
    }
    setTempUser({...tempUser, preferences: Array.from(current)});
  };

  const toggleMealSelection = (index: number) => {
    const next = new Set(selectedMealIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedMealIndices(next);
  };

  const handleShareWithCook = () => {
    if (!plan || !user) return;
    const selectedMeals = plan.meals.filter((_, i) => selectedMealIndices.has(i));
    if (selectedMeals.length === 0) {
      alert("Please select at least one meal to share.");
      return;
    }

    let message = `*Menu for ${user.name}*\n\n`;
    selectedMeals.forEach((m, idx) => {
      message += `*${m.name} - ${m.category}*\n\n`;
      message += `*1) Ingredients with Qty:*\n`;
      if (m.ingredients && m.ingredients.length > 0) {
        m.ingredients.forEach(ing => message += `- ${ing}\n`);
      } else {
        message += `(Standard recipe ingredients)\n`;
      }
      message += `\n*2) Cooking Instructions:*\n`;
      if (m.instructions && m.instructions.length > 0) {
        m.instructions.forEach((ins, i) => message += `${i + 1}. ${ins}\n`);
      } else {
        message += `(Standard preparation)\n`;
      }
      
      if (idx < selectedMeals.length - 1) {
        message += `\n--------------------------\n\n`;
      }
    });

    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  };

  // --- RENDERING ---

  if (view === 'ONBOARDING') {
    return (
      <div className="min-h-screen bg-[#FFF9F8] flex flex-col items-center justify-center p-10 text-[#4E342E] fade-in">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border border-[#F2D8D5] shadow-sm mb-8">
          <span className="serif italic text-5xl text-[#B76E79]">S</span>
        </div>
        <h1 className="text-5xl serif italic text-[#7E5752] mb-6 text-center">Saanvi.</h1>
        <p className="text-center mb-12 max-w-sm text-[17px] leading-relaxed text-[#947272] serif italic px-4">
          "Mama, the best gift you can give your baby is the healthiest and happiest version of you. I'm here to help nurture you through your first year."
        </p>
        <button 
          onClick={() => setView('ONBOARDING_FORM')}
          className="bg-[#B76E79] text-white px-12 py-5 rounded-full font-bold uppercase tracking-widest text-[11px] shadow-lg hover:scale-105 transition-transform"
        >
          Begin Journey
        </button>
      </div>
    );
  }

  if (view === 'ONBOARDING_FORM') {
    return (
      <div className="min-h-screen bg-[#FFF9F8] flex flex-col items-center justify-center p-6 text-[#4E342E] fade-in">
        <div className="max-w-md w-full bg-white rounded-[40px] p-8 border border-[#F2D8D5] shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#B76E79]">Step {onboardingStep} of 2</span>
            {onboardingStep > 1 && (
              <button onClick={() => setOnboardingStep(s => s - 1)} className="text-[10px] uppercase font-bold text-[#947272]">Back</button>
            )}
          </div>

          {onboardingStep === 1 && (
            <div className="space-y-6 fade-in">
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#947272] block mb-2">What shall I call you?</label>
                  <input 
                    type="text" 
                    value={tempUser.name}
                    onChange={e => setTempUser({...tempUser, name: e.target.value})}
                    placeholder="Your Name"
                    className="w-full bg-[#FFF9F8] border border-[#F2D8D5] rounded-2xl p-4 text-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#947272] block mb-2">When was your little one born?</label>
                  <input 
                    type="date" 
                    value={tempUser.birthDate}
                    onChange={e => setTempUser({...tempUser, birthDate: e.target.value})}
                    className={`w-full bg-[#FFF9F8] border rounded-2xl p-4 text-lg transition-colors ${dateError ? 'border-red-300' : 'border-[#F2D8D5]'}`}
                  />
                  {dateError && (
                    <p className="text-[11px] text-red-500 mt-2 italic serif">{dateError}</p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#947272] block mb-2">And your delivery type?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['Vaginal', 'C-section'] as const).map(type => (
                      <button 
                        key={type}
                        onClick={() => setTempUser({...tempUser, deliveryType: type})}
                        className={`py-4 rounded-2xl border text-center transition-all ${tempUser.deliveryType === type ? 'bg-[#B76E79] text-white border-[#B76E79]' : 'bg-[#FFF9F8] border-[#F2D8D5]'}`}
                      >
                        <span className="serif text-md">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 text-center">
                <p className="text-xs text-[#947272] serif italic">Saanvi will use this to personalize your rhythm.</p>
              </div>

              <button 
                disabled={!tempUser.name || !!dateError}
                onClick={() => setOnboardingStep(2)}
                className="w-full bg-[#B76E79] text-white py-5 rounded-3xl font-bold uppercase tracking-widest text-[11px] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="space-y-6 fade-in">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl serif italic text-[#7E5752]">"Nourishment?"</h2>
                  <button 
                    onClick={() => setTempUser({...tempUser, optedIntoFood: !tempUser.optedIntoFood})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${tempUser.optedIntoFood ? 'bg-[#B76E79]' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tempUser.optedIntoFood ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <p className="text-xs text-[#947272] serif italic">Healing starts with what you eat, {tempUser.name || 'Mama'}.</p>
              </div>

              {tempUser.optedIntoFood ? (
                <div className="space-y-4 fade-in">
                  <label className="text-[10px] uppercase font-bold text-[#947272] block">Any dietary preferences for me?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {DIETARY_OPTIONS.map(opt => (
                      <button 
                        key={opt}
                        onClick={() => togglePreference(opt)}
                        className={`p-4 rounded-2xl border text-[11px] font-bold uppercase tracking-wider transition-all ${tempUser.preferences.includes(opt) ? 'bg-[#B76E79] text-white border-[#B76E79]' : 'bg-[#FFF9F8] border-[#F2D8D5]'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#FFF0F0] p-6 rounded-3xl border border-[#F2D8D5] fade-in">
                  <p className="text-sm serif italic text-[#7E5752] leading-relaxed">
                    "{tempUser.name || 'Mama'}, nourishment is core to your healing. Targeted nutrition supports your recovery. May I keep this enabled?"
                  </p>
                  <button 
                    onClick={() => setTempUser({...tempUser, optedIntoFood: true})}
                    className="mt-4 text-[#B76E79] font-bold text-[10px] uppercase tracking-widest underline"
                  >
                    Yes, help me with nutrition
                  </button>
                </div>
              )}

              <button 
                onClick={finishOnboarding}
                className="w-full bg-[#B76E79] text-white py-5 rounded-3xl font-bold uppercase tracking-widest text-[11px]"
              >
                Check in
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9F8] text-[#4E342E] max-w-md mx-auto flex flex-col shadow-xl">
      <header className="p-6 pt-10 border-b border-[#F2D8D5] bg-white flex flex-col items-center sticky top-0 z-50">
        <h1 className="text-4xl serif italic text-[#7E5752]">Saanvi</h1>
        <p className="text-[10px] tracking-[3px] text-[#B76E79] uppercase font-bold mt-1">Your Daily Recovery Companion</p>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center p-10 text-center space-y-4 min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-[#B76E79] border-t-transparent rounded-full animate-spin"></div>
            <p className="serif italic text-xl text-[#7E5752]">Thinking of you, {user?.name}...</p>
            <p className="text-[10px] uppercase tracking-[2px] text-[#947272]">Preparing your healing path</p>
          </div>
        ) : (
          <div className="p-6 fade-in space-y-10 pb-12">
            {view === 'CHECKIN' && (
              <div className="space-y-8">
                <div className="bg-white p-5 rounded-3xl rounded-tl-none border border-[#F2D8D5] shadow-sm italic serif text-[#7E5752] leading-relaxed">
                  "Hi, {user?.name}. How are you feeling in your body and heart today?"
                </div>
                
                <div className="space-y-8">
                  {(['physical', 'emotional', 'lactation'] as const).map(cat => (
                    <section key={cat} className="space-y-3">
                      <h3 className="text-[10px] uppercase tracking-widest text-[#947272] font-bold ml-1">{cat}</h3>
                      <div className="flex flex-wrap gap-2">
                        {SYMPTOMS[cat].map(s => (
                          <button 
                            key={s}
                            onClick={() => {
                              const currentArr = check[cat] || [];
                              const currentSet = new Set(currentArr);
                              currentSet.has(s) ? currentSet.delete(s) : currentSet.add(s);
                              setCheck({...check, [cat]: Array.from(currentSet)});
                            }}
                            className={`px-4 py-2.5 rounded-full text-xs transition-all border ${check[cat]?.includes(s) ? 'bg-[#B76E79] text-white border-[#B76E79] shadow-md' : 'bg-white border-[#F2D8D5] text-[#5D4037]'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <button 
                  onClick={handleCheckIn}
                  className="w-full bg-[#B76E79] text-white py-5 rounded-3xl font-bold uppercase tracking-widest text-[11px] shadow-lg sticky bottom-4 transition-transform active:scale-95"
                >
                  Create My Healing Plan
                </button>
              </div>
            )}

            {view === 'PLAN' && plan && (
              <div className="space-y-10 fade-in">
                <div className="bg-white p-6 rounded-[32px] border border-[#F2D8D5] shadow-sm flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-[#B76E79] tracking-widest">Day {recoveryInfo.days} Postpartum</p>
                    <p className="text-sm serif italic text-[#7E5752]">{recoveryInfo.stage}</p>
                  </div>
                  <div className="text-right">
                    <button onClick={() => setView('CHECKIN')} className="text-[#B76E79] font-bold text-[9px] uppercase border border-[#B76E79] px-3 py-1.5 rounded-full">New Check-in</button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-[10px] uppercase font-bold text-[#947272] tracking-[3px] px-2">Today's Focus</p>
                  <h2 className="text-3xl serif italic text-[#7E5752] px-2">{plan.focus}</h2>
                </div>

                <div className="bg-[#FFF0F0] p-8 rounded-[40px] text-center italic text-xl leading-relaxed text-[#7E5752] serif border border-[#F2D8D5]">
                  "{plan.validation}"
                </div>

                <section className="bg-white p-8 rounded-[40px] border border-[#F2D8D5] shadow-sm space-y-6">
                  <h3 className="text-[10px] uppercase font-bold text-[#947272] tracking-widest">3 Gentle Steps</h3>
                  <ul className="space-y-5">
                    {plan.actions?.map((a, i) => (
                      <li key={i} className="flex gap-4 text-[15px] items-start">
                        <span className="text-[#B76E79] font-bold serif italic text-xl">{i+1}.</span>
                        <span className="leading-relaxed">{a}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="bg-white p-7 rounded-[32px] border border-[#F2D8D5] shadow-sm">
                  <h3 className="text-[10px] uppercase font-bold text-[#B76E79] tracking-widest">Safe to Let Go</h3>
                  <p className="mt-3 text-lg serif italic text-[#7E5752]">"{plan.ignore}"</p>
                </section>

                {user?.optedIntoFood && plan.meals && plan.meals.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-2">
                      <h3 className="text-[10px] uppercase font-bold text-[#947272] tracking-widest">Nourishment</h3>
                      <button 
                        onClick={handleShareWithCook}
                        className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm transition-transform active:scale-95"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        Share
                      </button>
                    </div>
                    <div className="space-y-4">
                      {plan.meals.map((m, i) => (
                        <div 
                          key={i} 
                          onClick={() => toggleMealSelection(i)}
                          className={`bg-white p-6 rounded-[32px] border transition-all cursor-pointer ${selectedMealIndices.has(i) ? 'border-[#B76E79] shadow-md ring-1 ring-[#B76E79]/20' : 'border-[#F2D8D5] shadow-sm opacity-60'}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedMealIndices.has(i) ? 'bg-[#B76E79] border-[#B76E79]' : 'border-[#F2D8D5]'}`}>
                                {selectedMealIndices.has(i) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-[#B76E79] uppercase">{m.category}</span>
                                <h4 className="text-xl serif font-bold text-[#7E5752]">{m.name}</h4>
                              </div>
                            </div>
                          </div>
                          <p className="text-[13px] italic text-[#947272] mt-3 ml-8">"{m.why}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    localStorage.removeItem(STORAGE_KEY);
                    setView('ONBOARDING');
                    setOnboardingStep(1);
                  }}
                  className="w-full py-4 text-[#947272] text-[10px] font-bold uppercase tracking-widest border border-dashed border-[#F2D8D5] rounded-3xl"
                >
                  Reset Journey
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-6 bg-white border-t border-[#F2D8D5] text-center mt-auto">
        <p className="text-[10px] text-[#947272] uppercase tracking-widest font-bold opacity-80">Holistic Preventive Care</p>
        <p className="text-[9px] text-[#947272] mt-1 italic px-4 leading-tight opacity-60">
          Wellness support (non-medical). Always consult your doctor for medical concerns.
        </p>
      </footer>
    </div>
  );
};

export default App;
