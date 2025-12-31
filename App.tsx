
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserState, AppStatus, DailyMessage, MealItem, Symptom } from './types';
import { STORAGE_KEY, SYMPTOMS } from './constants';
import { generateDailyMessage } from './services/geminiService';

const CheckInStepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => (
  <div className="flex gap-2 mb-8">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <div 
        key={i} 
        className={`h-1 flex-1 rounded-full transition-all duration-500 ${
          i <= currentStep ? 'bg-[#D4A373]' : 'bg-[#F2E8DF]'
        }`} 
      />
    ))}
  </div>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.LOADING);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [dailyMessage, setDailyMessage] = useState<DailyMessage | null>(null);
  
  const [checkInStep, setCheckInStep] = useState(0);
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<Set<string>>(new Set());
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [selectedMealIndices, setSelectedMealIndices] = useState<number[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setUserState(parsed);
      setStatus(AppStatus.READY);
    } else {
      setStatus(AppStatus.ONBOARDING);
    }
  }, []);

  const saveState = (newState: UserState) => {
    setUserState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const handleOnboardingSubmit = (name: string, birthDate: string, food: boolean) => {
    const newState: UserState = {
      name,
      birthDate,
      onboardingComplete: true,
      optedIntoFood: food,
      history: []
    };
    saveState(newState);
    setStatus(AppStatus.READY);
  };

  const fetchMessage = useCallback(async (symptoms: string[]) => {
    if (!userState) return;
    setIsGenerating(true);
    setApiError(null);
    try {
      const msg = await generateDailyMessage(userState, symptoms);
      setDailyMessage(msg);
      if (msg.meals) {
        setSelectedMealIndices(msg.meals.map((_, i) => i));
      }
      setShowPlan(true);
    } catch (e: any) {
      const isQuota = e?.message?.includes('429') || JSON.stringify(e).includes('429');
      if (isQuota) {
        setApiError("The recovery guide is taking a short rest due to high demand. Please try again in a few minutes.");
      } else {
        setApiError("I'm having a little trouble connecting. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  }, [userState]);

  const toggleSymptom = (id: string) => {
    setSelectedSymptomIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const categories: Symptom['category'][] = ['Physical', 'Internal', 'Emotional'];
  const currentCategory = categories[checkInStep];
  const currentSymptoms = useMemo(() => 
    SYMPTOMS.filter(s => s.category === currentCategory),
    [currentCategory]
  );

  const nextCheckInStep = () => {
    if (checkInStep < categories.length - 1) {
      setCheckInStep(checkInStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const symptoms = Array.from(selectedSymptomIds);
      if (userState) {
        const today = new Date().toISOString().split('T')[0];
        const newHistory = [...userState.history];
        const todayIdx = newHistory.findIndex(h => h.date === today);
        
        if (todayIdx > -1) {
          newHistory[todayIdx].symptomIds = symptoms;
        } else {
          newHistory.push({ date: today, symptomIds: symptoms });
        }
        
        saveState({ ...userState, history: newHistory.slice(-30) }); 
        fetchMessage(symptoms);
      }
    }
  };

  const prevCheckInStep = () => {
    if (checkInStep > 0) setCheckInStep(checkInStep - 1);
  };

  const resetToday = () => {
    setShowPlan(false);
    setCheckInStep(0);
    setSelectedSymptomIds(new Set());
    setDailyMessage(null);
    setSelectedMealIndices([]);
    setApiError(null);
  };

  const openWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const toggleMealSelection = (index: number) => {
    setSelectedMealIndices(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

  const shareWithCook = () => {
    if (!dailyMessage || !dailyMessage.meals) return;
    const selectedMeals = dailyMessage.meals.filter((_, i) => selectedMealIndices.includes(i));
    
    if (selectedMeals.length === 0) {
      alert("Please select at least one meal.");
      return;
    }

    let text = `*Postpartum Recovery Meals*\n\n`;
    text += `Hi, please prepare these for me today:\n\n`;
    
    selectedMeals.forEach(meal => {
      text += `🥘 *${meal.name.toUpperCase()}*\n`;
      text += `_Ingredients:_\n`;
      meal.ingredients.forEach(ing => {
        text += `- ${ing}\n`;
      });
      text += `_Steps:_\n`;
      meal.steps.forEach((step, idx) => {
        text += `${idx + 1}. ${step}\n`;
      });
      text += `\n`;
    });
    
    text += `Thank you!`;
    
    openWhatsApp(text);
  };

  const shareWithSpouse = () => {
    if (!dailyMessage) return;
    const text = `Hi, I received this update today:\n\n"${dailyMessage.spouseMessage}"`;
    openWhatsApp(text);
  };

  if (status === AppStatus.LOADING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF8F4]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#D4A373] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-[#A88B73] tracking-[0.2em] uppercase">Checking in</p>
        </div>
      </div>
    );
  }

  if (status === AppStatus.ONBOARDING) {
    return <Onboarding onComplete={handleOnboardingSubmit} />;
  }

  if (showSettings && userState) {
    return (
      <SettingsView 
        userState={userState} 
        onSave={(updated) => {
          saveState(updated);
          setShowSettings(false);
        }} 
        onClose={() => setShowSettings(false)} 
      />
    );
  }

  const daysSinceBirth = userState 
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(userState.birthDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-[#FDF8F4] flex flex-col max-w-md mx-auto relative overflow-hidden">
      <main className="flex-1 px-6 pt-12 pb-24 overflow-y-auto">
        <header className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl text-[#6D4C3D] font-semibold serif">
              Hi, {userState?.name}.
            </h1>
            <p className="text-sm text-[#A88B73] tracking-tight">Postpartum Check-in</p>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full bg-white border border-[#F2E8DF] shadow-sm active:scale-95 transition-transform"
            aria-label="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A88B73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </header>

        {!showPlan ? (
          <div className="fade-in">
            {isGenerating ? (
              <div className="py-24 text-center animate-pulse flex flex-col items-center justify-center">
                <div className="mb-8 opacity-40">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <p className="text-lg serif italic text-[#6D4C3D] opacity-80 mb-2">Preparing your recovery plan</p>
                <p className="text-xs tracking-widest text-[#A88B73] uppercase">Listening to your check-in...</p>
              </div>
            ) : apiError ? (
              <div className="py-12 px-4 text-center fade-in bg-white rounded-2xl border border-[#F2E8DF] shadow-sm">
                <div className="text-[#6D4C3D] mb-6 text-sm leading-relaxed serif italic">
                  {apiError}
                </div>
                <button 
                  onClick={() => fetchMessage(Array.from(selectedSymptomIds))}
                  className="w-full bg-[#D4A373] text-white py-4 rounded-xl font-bold shadow-sm active:scale-95 transition-transform"
                >
                  Try Again
                </button>
                <button 
                  onClick={resetToday}
                  className="block w-full mt-6 text-[#A88B73] text-[10px] uppercase font-bold tracking-widest"
                >
                  Cancel and start over
                </button>
              </div>
            ) : (
              <>
                <CheckInStepIndicator currentStep={checkInStep} totalSteps={categories.length} />
                
                <p className="text-[#A88B73] leading-relaxed mb-6 font-medium">
                  {currentCategory === 'Physical' && "How is your body feeling? Select All that Apply"}
                  {currentCategory === 'Internal' && "What's happening inside? Select All that Apply"}
                  {currentCategory === 'Emotional' && "How is your heart and mind? Select All that Apply"}
                </p>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-3">
                    {currentSymptoms.map(symptom => (
                      <button
                        key={symptom.id}
                        onClick={() => toggleSymptom(symptom.id)}
                        className={`flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-[0.98] ${
                          selectedSymptomIds.has(symptom.id)
                            ? 'bg-[#FAF5F1] border-[#D4A373] shadow-inner'
                            : 'bg-white border-[#F2E8DF] shadow-sm'
                        }`}
                      >
                        <span className={`text-sm font-medium ${selectedSymptomIds.has(symptom.id) ? 'text-[#6D4C3D]' : 'text-[#4A3728]'}`}>
                          {symptom.label}
                        </span>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                          selectedSymptomIds.has(symptom.id) ? 'bg-[#D4A373] border-[#D4A373]' : 'border-[#F2E8DF]'
                        }`}>
                          {selectedSymptomIds.has(symptom.id) && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                      </button>
                    ))}
                    {currentSymptoms.length === 0 && (
                      <div className="py-10 text-center opacity-40 italic text-sm">No symptoms found in this category.</div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    {checkInStep > 0 && (
                      <button 
                        onClick={prevCheckInStep}
                        className="flex-1 border border-[#E8D5C4] text-[#6D4C3D] py-4 rounded-xl font-bold"
                      >
                        Back
                      </button>
                    )}
                    <button 
                      onClick={nextCheckInStep}
                      className="flex-[2] bg-[#6D4C3D] text-white py-4 rounded-xl font-bold shadow-md active:scale-95 transition-transform"
                    >
                      {checkInStep === categories.length - 1 
                        ? (selectedSymptomIds.size === 0 ? 'I feel steady' : 'Finish Check-in') 
                        : 'Continue'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : dailyMessage ? (
          <div className="space-y-8 fade-in pb-10">
            <header className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-xl text-[#6D4C3D] font-semibold serif">Today’s Plan</h1>
                <p className="text-[10px] uppercase tracking-widest text-[#A88B73]">Day {daysSinceBirth} Recovery</p>
              </div>
              <button 
                onClick={resetToday}
                className="text-[10px] uppercase font-bold text-[#D4A373] tracking-tighter hover:opacity-70"
              >
                Reset
              </button>
            </header>

            <section className="bg-white p-6 rounded-2xl border border-[#F2E8DF] shadow-sm">
              <p className="text-lg leading-relaxed text-[#6D4C3D] italic serif">
                {dailyMessage.reassurance}
              </p>
            </section>

            <section>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#A88B73] font-bold mb-3">Today's Focus</h3>
              <p className="text-2xl text-[#4A3728] font-medium serif italic leading-tight">
                {dailyMessage.focus}
              </p>
            </section>

            <section>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#A88B73] font-bold mb-4">Steps to take</h3>
              <ul className="space-y-4">
                {dailyMessage.actions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-[#4A3728]">
                    <span className="text-[#D4A373] mt-1 text-lg leading-none">○</span>
                    <span className="leading-snug">{action}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-[#F8EFE7] p-4 rounded-xl border border-[#E8D5C4] border-dashed">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6D4C3D] mb-1 opacity-70">Permission to ignore</h3>
              <p className="text-[#6D4C3D] text-sm italic">
                {dailyMessage.ignore}
              </p>
            </section>

            {userState?.optedIntoFood && dailyMessage.meals && dailyMessage.meals.length > 0 ? (
              <section className="bg-white border border-[#E8D5C4] p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] uppercase tracking-widest text-[#A88B73] font-bold">Nourishment</h3>
                  <p className="text-[9px] text-[#A88B73] uppercase tracking-tighter">Tap to toggle</p>
                </div>
                
                <div className="space-y-2 mb-6">
                  {dailyMessage.meals.map((meal, idx) => (
                    <button 
                      key={idx}
                      onClick={() => toggleMealSelection(idx)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                        selectedMealIndices.includes(idx) 
                          ? 'border-[#D4A373] bg-[#FAF5F1] text-[#4A3728]' 
                          : 'border-[#F2E8DF] bg-white text-[#A88B73] opacity-60'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        selectedMealIndices.includes(idx) 
                          ? 'bg-[#D4A373] border-[#D4A373]' 
                          : 'border-[#E8D5C4]'
                      }`}>
                        {selectedMealIndices.includes(idx) && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </div>
                      <span className="text-sm font-medium serif italic">{meal.name}</span>
                    </button>
                  ))}
                </div>

                <button 
                  onClick={shareWithCook}
                  className="w-full flex items-center justify-center gap-3 bg-[#25D366] text-white py-4 rounded-xl font-bold shadow-md hover:bg-[#1EBE57] transition-colors active:scale-[0.98]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-7.6 8.38 8.38 0 0 1 3.8.9L22 4l-2.5 5.5Z"/></svg>
                  <span>Send Menu to Cook</span>
                </button>
              </section>
            ) : userState?.optedIntoFood && dailyMessage.meals && dailyMessage.meals.length === 0 ? (
               <div className="p-4 text-center border border-[#F2E8DF] rounded-xl text-xs text-[#A88B73] italic">
                No specific meals recommended for this state. Stick to warm, simple foods.
              </div>
            ) : !userState?.optedIntoFood ? (
              <button 
                onClick={() => {
                  if (userState) saveState({ ...userState, optedIntoFood: true });
                  fetchMessage(Array.from(selectedSymptomIds));
                }}
                className="w-full bg-white border border-[#D4A373] text-[#D4A373] py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#FAF5F1] transition-colors"
              >
                Enable Meal Suggestions
              </button>
            ) : null}

            <div className="pt-6 border-t border-[#F2E8DF]">
               <button 
                onClick={shareWithSpouse}
                className="w-full bg-white border border-[#E8D5C4] p-4 rounded-xl flex items-center justify-between text-left hover:bg-[#FAF5F1] transition-colors shadow-sm"
               >
                 <div className="flex items-center gap-4">
                   <div className="p-2 rounded-full bg-[#25D366]/10">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-7.6 8.38 8.38 0 0 1 3.8.9L22 4l-2.5 5.5Z"/></svg>
                   </div>
                   <div>
                     <p className="text-[10px] uppercase tracking-widest text-[#A88B73] mb-0.5 font-bold">Partner</p>
                     <p className="text-[#4A3728] text-sm font-medium">Send support update</p>
                   </div>
                 </div>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A88B73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
               </button>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="p-4 text-center text-[8px] text-[#A88B73] tracking-[0.2em] opacity-40 uppercase">
        Recovery Companion • Local Storage only
      </footer>
    </div>
  );
};

const SettingsView: React.FC<{ userState: UserState, onSave: (updated: UserState) => void, onClose: () => void }> = ({ userState, onSave, onClose }) => {
  const [name, setName] = useState(userState.name);
  const [birthDate, setBirthDate] = useState(userState.birthDate);
  const [food, setFood] = useState(userState.optedIntoFood);

  return (
    <div className="min-h-screen bg-[#FDF8F4] flex flex-col p-8 max-w-md mx-auto fade-in">
      <header className="flex justify-between items-center mb-12">
        <h2 className="text-2xl text-[#6D4C3D] font-semibold serif">Your Settings</h2>
        <button onClick={onClose} className="p-2 text-[#A88B73]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </header>
      
      <div className="space-y-8 flex-1">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-[#A88B73] font-bold">Display Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-[#F2E8DF] p-4 rounded-xl text-[#4A3728] focus:outline-none focus:border-[#D4A373]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-[#A88B73] font-bold">Baby's Arrival Date</label>
          <input 
            type="date" 
            value={birthDate} 
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full bg-white border border-[#F2E8DF] p-4 rounded-xl text-[#4A3728] focus:outline-none focus:border-[#D4A373]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-[#A88B73] font-bold">Nutrition Guidance</label>
          <label className="flex items-center gap-4 p-5 bg-white rounded-xl border border-[#F2E8DF] shadow-sm cursor-pointer">
            <input type="checkbox" checked={food} onChange={(e) => setFood(e.target.checked)} className="w-5 h-5 accent-[#6D4C3D]" />
            <span className="text-sm text-[#4A3728] font-medium">Daily meal plan suggestions</span>
          </label>
        </div>
      </div>

      <button 
        onClick={() => onSave({ ...userState, name, birthDate, optedIntoFood: food })}
        className="w-full bg-[#6D4C3D] text-white py-5 rounded-xl font-bold shadow-md hover:opacity-90 transition-opacity mt-auto mb-4"
      >
        Save Changes
      </button>
      <button 
        onClick={() => {
          if (confirm("This will clear your local history and data. Proceed?")) {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
          }
        }}
        className="w-full text-red-400 text-[10px] uppercase font-bold tracking-widest mb-10"
      >
        Reset App Data
      </button>
    </div>
  );
};

const Onboarding: React.FC<{ onComplete: (name: string, date: string, food: boolean) => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [food, setFood] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBirthDate(val);
    if (!val) {
      setError(null);
      return;
    }

    const selected = new Date(val);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    if (selected > today) {
      setError("Please choose a date in the past.");
    } else if (selected < oneYearAgo) {
      setError("This guidance is designed for the first twelve months. You're past that window now, but you're welcome to use the app for grounding.");
    } else {
      setError(null);
    }
  };

  const next = () => {
    if (step === 3) {
      const selected = new Date(birthDate);
      const today = new Date();
      if (selected > today) return;
    }
    setStep(step + 1);
  };

  const prev = () => {
    if (step > 1) setStep(step - 1);
  };

  const isBirthDateInvalid = !birthDate || (new Date(birthDate) > new Date());

  return (
    <div className="min-h-screen bg-[#FDF8F4] flex flex-col p-8 max-w-md mx-auto justify-center">
      {step === 1 && (
        <div className="fade-in space-y-6">
          <h1 className="text-4xl text-[#6D4C3D] font-bold serif italic">Steady Recovery.</h1>
          <p className="text-[#A88B73] leading-relaxed text-lg">Practical, quiet guidance for your first year postpartum. Grounded in softness.</p>
          <button onClick={next} className="w-full bg-[#6D4C3D] text-white py-5 rounded-xl font-medium shadow-sm active:scale-[0.98] transition-transform">Check in</button>
        </div>
      )}

      {step === 2 && (
        <div className="fade-in space-y-6">
          <h2 className="text-2xl text-[#6D4C3D] font-semibold serif">What should I call you?</h2>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border-b border-[#E8D5C4] bg-transparent py-4 text-2xl focus:outline-none focus:border-[#6D4C3D]"
            placeholder="Your name"
            autoFocus
          />
          <button disabled={!name.trim()} onClick={next} className="w-full bg-[#6D4C3D] text-white py-5 rounded-xl font-medium disabled:opacity-50 shadow-sm active:scale-[0.98] transition-transform">Next</button>
        </div>
      )}

      {step === 3 && (
        <div className="fade-in space-y-6">
          <h2 className="text-2xl text-[#6D4C3D] font-semibold serif">When was your baby born?</h2>
          <div className="relative">
            <input 
              type="date" 
              value={birthDate}
              onChange={handleDateChange}
              max={new Date().toISOString().split('T')[0]}
              className="w-full border-b border-[#E8D5C4] bg-transparent py-4 text-2xl focus:outline-none focus:border-[#6D4C3D] appearance-none"
              autoFocus
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6D4C3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
          </div>
          {error && <p className="text-xs text-[#6D4C3D] italic bg-[#F8EFE7] p-3 rounded-lg fade-in leading-relaxed">{error}</p>}
          <div className="flex gap-4">
            <button onClick={prev} className="flex-1 border border-[#E8D5C4] text-[#6D4C3D] py-5 rounded-xl font-medium">Back</button>
            <button disabled={isBirthDateInvalid} onClick={next} className="flex-[2] bg-[#6D4C3D] text-white py-5 rounded-xl font-medium disabled:opacity-50 shadow-sm active:scale-[0.98] transition-transform">Next</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="fade-in space-y-6">
          <h2 className="text-2xl text-[#6D4C3D] font-semibold serif">Nourishment Suggestions?</h2>
          <p className="text-sm text-[#A88B73] leading-relaxed">I can suggest daily meals to help with your recovery. You can opt out of meal suggestions anytime</p>
          <label className="flex items-center gap-4 p-6 bg-white rounded-xl border border-[#F2E8DF] shadow-sm cursor-pointer">
            <input type="checkbox" checked={food} onChange={(e) => setFood(e.target.checked)} className="w-6 h-6 accent-[#6D4C3D]" />
            <span className="text-[#4A3728] font-medium leading-relaxed">Opt in to meal suggestions</span>
          </label>
          <div className="flex gap-4">
            <button onClick={prev} className="flex-1 border border-[#E8D5C4] text-[#6D4C3D] py-5 rounded-xl font-medium">Back</button>
            <button onClick={() => onComplete(name, birthDate, food)} className="flex-[2] bg-[#6D4C3D] text-white py-5 rounded-xl font-bold shadow-md active:scale-95 transition-transform">Finish Check in</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
