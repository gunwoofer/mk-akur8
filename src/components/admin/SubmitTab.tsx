"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubmitFlow, type Step } from "@/hooks/useSubmitFlow";
import LobbyStep from "./submit/LobbyStep";
import RacesStep from "./submit/RacesStep";
import PositionsStep from "./submit/PositionsStep";
import SuccessStep from "./submit/SuccessStep";

const STEP_LABELS: Record<number, string> = { 1: "Lobby", 2: "Races", 3: "Positions" };

export default function SubmitTab() {
  const flow = useSubmitFlow();
  const prevStep = useRef(flow.step);
  const dir = flow.step > prevStep.current ? 1 : -1;
  prevStep.current = flow.step;

  // The Races step only exists when race-by-race recording is on.
  const steps: Step[] = flow.recordRaces ? [1, 2, 3] : [1, 3];
  const racers = flow.players.filter((p) => flow.selected.has(p.id));

  return (
    <div>
      {flow.step < 4 && (
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`h-px w-5 transition-colors duration-300 ${flow.step >= s ? "bg-[#00d4ff]" : "bg-[#222]"}`} />
              )}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${
                flow.step === s
                  ? "bg-[#00d4ff] text-black scale-110"
                  : flow.step > s
                  ? "bg-[#00d4ff]/20 text-[#00d4ff]"
                  : "bg-[#1f1f1f] text-gray-600"
              }`}>
                {flow.step > s ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-medium transition-colors ${flow.step === s ? "text-white" : "text-gray-600"}`}>
                {STEP_LABELS[s]}
              </span>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={flow.step}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.2, ease: [0.25, 0, 0.2, 1] }}
        >
          {flow.step === 1 && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              <div>
                <h2 className="text-white font-bold text-lg leading-none">Select Lobby</h2>
                <p className="text-gray-600 text-xs mt-1">Tap everyone who raced in this GP</p>
              </div>
              <LobbyStep
                players={flow.players}
                loading={flow.loadingPlayers}
                error={flow.fetchError}
                selected={flow.selected}
                onToggle={flow.toggleSelect}
                recordRaces={flow.recordRaces}
                onToggleRecordRaces={flow.setRecordRaces}
                onNext={flow.recordRaces ? flow.startRaces : flow.goToPositions}
              />
            </div>
          )}
          {flow.step === 2 && (
            <RacesStep
              key={flow.raceIndex}
              racers={racers}
              tracks={flow.tracks}
              races={flow.races}
              raceIndex={flow.raceIndex}
              onSelectRace={flow.setRaceIndex}
              onSetTrack={flow.setRaceTrack}
              onSetPosition={flow.setRacePosition}
              onSetRaceCount={flow.setRaceCount}
              onBack={() => flow.setStep(1)}
              onFinish={flow.goToPositions}
            />
          )}
          {flow.step === 3 && (
            <PositionsStep
              slots={flow.slots}
              playerById={flow.playerById}
              placedIds={flow.placedIds}
              submitting={flow.submitting}
              submitError={flow.submitError}
              onPlacePlayer={flow.placePlayer}
              onClearPlayer={flow.clearPlayer}
              onSubmit={flow.submit}
              onBack={() => flow.setStep(flow.recordRaces ? 2 : 1)}
            />
          )}
          {flow.step === 4 && <SuccessStep onReset={flow.reset} onRematch={flow.rematch} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
