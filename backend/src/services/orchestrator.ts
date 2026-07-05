import { processConversationTurn } from './stateManager';
import { bookAppointment, checkDoctorAvailability } from './booking';
import { cancelAppointment } from './cancellation';
import { rescheduleAppointment } from './rescheduling';
import { queryKnowledgeBase } from './kbEngine';
import { Logger } from '../utils/logger';

export interface OrchestratorResult {
  selected_tool: 'BOOK_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'RESCHEDULE_APPOINTMENT' | 'HOSPITAL_FAQ' | 'HUMAN_HANDOFF' | 'NONE';
  reason: string;
  result: any;
}

export const orchestrateTurn = async (
  callSid: string,
  userUtterance: string,
  hospitalId: string,
  callerPhone: string
): Promise<OrchestratorResult> => {
  try {
    // 1. Process the conversation turn via the State Manager
    const state = await processConversationTurn(callSid, userUtterance, callerPhone, hospitalId);

    // 2. Routing Decision Tree based on Intent and State
    
    // Turn A: TALK_TO_HUMAN
    if (state.intent === 'TALK_TO_HUMAN') {
      Logger.info(`Orchestrator routed to HUMAN_HANDOFF for CallSid: ${callSid}`, 'ORCHESTRATOR');
      return {
        selected_tool: 'HUMAN_HANDOFF',
        reason: 'Customer explicitly requested to speak with a human agent.',
        result: { status: 'HANDOVER_INITIATED', phone: callerPhone },
      };
    }

    // Turn B: BOOK_APPOINTMENT
    if (state.intent === 'BOOK_APPOINTMENT') {
      if (state.state === 'CONFIRMED') {
        Logger.info(`Orchestrator routed to BOOK_APPOINTMENT for CallSid: ${callSid}`, 'ORCHESTRATOR');
        const bookingResult = await bookAppointment(callSid, state, hospitalId);
        return {
          selected_tool: 'BOOK_APPOINTMENT',
          reason: 'Customer confirmed all appointment details.',
          result: bookingResult,
        };
      } else if (state.state === 'CONFIRMATION_REQUIRED') {
        // Intercept confirmation to check availability
        if (state.doctorId && state.date && state.time) {
          const isAvailable = await checkDoctorAvailability(state.doctorId, state.date, state.time);
          if (!isAvailable) {
            Logger.info(`Doctor ${state.doctor} is unavailable at ${state.date} ${state.time}. Rejecting confirmation.`, 'ORCHESTRATOR');
            state.doctor_unavailable = true;
            state.state = 'COLLECTING_INFORMATION';
            // Important: Do not save back to stateManager immediately, but we can pass it so ResponseGenerator uses it.
            // Wait, stateManager manages in-memory state. Since `processConversationTurn` already ran, we should probably update the in-memory state.
            // For now, the response generator will see `doctor_unavailable` and ask the user to pick another time.
          }
        }
        return {
          selected_tool: 'NONE',
          reason: 'Awaiting final confirmation.',
          result: state,
        };
      } else {
        // Still collecting slot details
        return {
          selected_tool: 'NONE',
          reason: 'Still collecting appointment details or awaiting final confirmation.',
          result: state,
        };
      }
    }

    // Turn C: CANCEL_APPOINTMENT
    if (state.intent === 'CANCEL_APPOINTMENT') {
      Logger.info(`Orchestrator routed to CANCEL_APPOINTMENT for CallSid: ${callSid}`, 'ORCHESTRATOR');
      const cancelResult = await cancelAppointment(callerPhone, hospitalId, state.doctorId, state.date);
      return {
        selected_tool: 'CANCEL_APPOINTMENT',
        reason: 'Customer requested appointment cancellation.',
        result: cancelResult,
      };
    }

    // Turn D: RESCHEDULE_APPOINTMENT
    if (state.intent === 'RESCHEDULE_APPOINTMENT') {
      Logger.info(`Orchestrator routed to RESCHEDULE_APPOINTMENT for CallSid: ${callSid}`, 'ORCHESTRATOR');
      const rescheduleResult = await rescheduleAppointment(
        callerPhone,
        hospitalId,
        state.date,
        state.time,
        state.doctorId
      );
      return {
        selected_tool: 'RESCHEDULE_APPOINTMENT',
        reason: 'Customer requested to reschedule an appointment.',
        result: rescheduleResult,
      };
    }

    // Turn E: ASK_HOSPITAL_INFORMATION
    if (state.intent === 'ASK_HOSPITAL_INFORMATION') {
      Logger.info(`Orchestrator routed to HOSPITAL_FAQ for CallSid: ${callSid}`, 'ORCHESTRATOR');
      const faqResult = await queryKnowledgeBase(hospitalId, userUtterance);
      return {
        selected_tool: 'HOSPITAL_FAQ',
        reason: 'Customer asked a hospital information question.',
        result: faqResult,
      };
    }

    // Turn F: UNKNOWN / Default (check FAQ first in case of classification noise)
    Logger.info(`Orchestrator routing UNKNOWN intent check to HOSPITAL_FAQ for CallSid: ${callSid}`, 'ORCHESTRATOR');
    const faqResult = await queryKnowledgeBase(hospitalId, userUtterance);
    
    if (faqResult.status === 'ANSWER_FOUND') {
      return {
        selected_tool: 'HOSPITAL_FAQ',
        reason: 'Customer question answered via semantic FAQ lookup.',
        result: faqResult,
      };
    }

    return {
      selected_tool: 'NONE',
      reason: 'No matching tool found for user utterance.',
      result: { status: 'UNKNOWN_INTENT', transcript: userUtterance },
    };
  } catch (error) {
    Logger.error('Orchestration layer failure', error, 'ORCHESTRATOR');
    return {
      selected_tool: 'NONE',
      reason: 'An internal error occurred during orchestration.',
      result: { error: 'INTERNAL_ERROR' },
    };
  }
};
