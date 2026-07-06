import { processConversationTurn } from './stateManager';
import { bookAppointment } from './booking';
import { cancelAppointment } from './cancellation';
import { rescheduleAppointment } from './rescheduling';
import { changeDoctor, changeDate, changeTime } from './modification';
import { queryKnowledgeBase } from './kbEngine';
import { Logger } from '../utils/logger';
import { broadcastToDashboard } from './eventHub';

export interface OrchestratorResult {
  selected_tool: 
    | 'BOOK_APPOINTMENT' 
    | 'CANCEL_APPOINTMENT' 
    | 'RESCHEDULE_APPOINTMENT' 
    | 'CHANGE_DOCTOR' 
    | 'CHANGE_DATE' 
    | 'CHANGE_TIME' 
    | 'APPOINTMENT_STATUS' 
    | 'UPCOMING_APPOINTMENTS' 
    | 'PAST_APPOINTMENTS' 
    | 'HOSPITAL_FAQ' 
    | 'HUMAN_HANDOFF' 
    | 'NONE';
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
    // 1. Process conversation state turn
    const state = await processConversationTurn(callSid, userUtterance, callerPhone, hospitalId);

    // 2. Human Handoff Routing
    if (state.intent === 'TALK_TO_HUMAN') {
      Logger.info(`Orchestrator routed to HUMAN_HANDOFF for CallSid: ${callSid}`, 'ORCHESTRATOR');
      return {
        selected_tool: 'HUMAN_HANDOFF',
        reason: 'Customer explicitly requested to speak with a human agent.',
        result: { status: 'HANDOVER_INITIATED', phone: callerPhone },
      };
    }

    // 3. Dispatch based on operation
    if (state.operation === 'BOOK') {
      if (state.state === 'CONFIRMED') {
        Logger.info(`[STATE_TRANSITION] booking started for CallSid: ${callSid}`, 'ORCHESTRATOR');
        const bookingResult = await bookAppointment(callSid, state, hospitalId);
        if (bookingResult.status === 'BOOKED' || bookingResult.status === 'SUCCESS' as any) {
          broadcastToDashboard({ type: 'REFRESH_DASHBOARD' });
        }
        return {
          selected_tool: 'BOOK_APPOINTMENT',
          reason: 'Customer confirmed all appointment booking details.',
          result: bookingResult,
        };
      }
      return {
        selected_tool: 'NONE',
        reason: state.state === 'CONFIRMATION_REQUIRED' ? 'Awaiting final booking confirmation.' : 'Still collecting booking details.',
        result: state,
      };
    }

    if (state.operation === 'CANCEL') {
      if (!state.activeAppointmentId) {
        return {
          selected_tool: 'NONE',
          reason: 'No active upcoming appointment was found to cancel.',
          result: { status: 'FAILED_NOT_FOUND', message: 'No upcoming appointment found.' },
        };
      }
      if (state.state === 'CONFIRMED') {
        Logger.info(`Orchestrator executing cancelAppointment for CallSid: ${callSid}`, 'ORCHESTRATOR');
        const cancelResult = await cancelAppointment(callSid, state.activeAppointmentId, hospitalId);
        broadcastToDashboard({ type: 'REFRESH_DASHBOARD' });
        return {
          selected_tool: 'CANCEL_APPOINTMENT',
          reason: 'Appointment cancellation confirmed by user.',
          result: cancelResult,
        };
      }
      return {
        selected_tool: 'NONE',
        reason: 'Awaiting confirmation for cancellation.',
        result: state,
      };
    }

    if (state.operation === 'RESCHEDULE') {
      if (!state.activeAppointmentId) {
        return {
          selected_tool: 'NONE',
          reason: 'No active upcoming appointment was found to reschedule.',
          result: { status: 'FAILED_NOT_FOUND', message: 'No upcoming appointment found.' },
        };
      }
      if (state.state === 'CONFIRMED') {
        Logger.info(`Orchestrator executing rescheduleAppointment for CallSid: ${callSid}`, 'ORCHESTRATOR');
        const rescheduleResult = await rescheduleAppointment(
          callSid,
          state.activeAppointmentId,
          state.date,
          state.time,
          hospitalId
        );
        broadcastToDashboard({ type: 'REFRESH_DASHBOARD' });
        return {
          selected_tool: 'RESCHEDULE_APPOINTMENT',
          reason: 'Reschedule confirmed by user.',
          result: rescheduleResult,
        };
      }
      return {
        selected_tool: 'NONE',
        reason: 'Collecting reschedule details or awaiting confirmation.',
        result: state,
      };
    }

    if (state.operation === 'CHANGE_DOCTOR') {
      if (!state.activeAppointmentId) {
        return {
          selected_tool: 'NONE',
          reason: 'No active upcoming appointment was found to modify.',
          result: { status: 'FAILED_NOT_FOUND', message: 'No upcoming appointment found.' },
        };
      }
      if (state.state === 'CONFIRMED' && state.doctorId) {
        Logger.info(`Orchestrator executing changeDoctor for CallSid: ${callSid}`, 'ORCHESTRATOR');
        const changeResult = await changeDoctor(callSid, state.activeAppointmentId, state.doctorId, hospitalId);
        broadcastToDashboard({ type: 'REFRESH_DASHBOARD' });
        return {
          selected_tool: 'CHANGE_DOCTOR',
          reason: 'Doctor change confirmed by user.',
          result: changeResult,
        };
      }
      return {
        selected_tool: 'NONE',
        reason: 'Selecting new doctor or awaiting confirmation.',
        result: state,
      };
    }

    if (state.operation === 'CHANGE_DATE') {
      if (!state.activeAppointmentId) {
        return {
          selected_tool: 'NONE',
          reason: 'No active upcoming appointment was found to modify.',
          result: { status: 'FAILED_NOT_FOUND', message: 'No upcoming appointment found.' },
        };
      }
      if (state.state === 'CONFIRMED' && state.date) {
        Logger.info(`Orchestrator executing changeDate for CallSid: ${callSid}`, 'ORCHESTRATOR');
        const changeResult = await changeDate(callSid, state.activeAppointmentId, state.date, hospitalId);
        broadcastToDashboard({ type: 'REFRESH_DASHBOARD' });
        return {
          selected_tool: 'CHANGE_DATE',
          reason: 'Date change confirmed by user.',
          result: changeResult,
        };
      }
      return {
        selected_tool: 'NONE',
        reason: 'Selecting new date or awaiting confirmation.',
        result: state,
      };
    }

    if (state.operation === 'CHANGE_TIME') {
      if (!state.activeAppointmentId) {
        return {
          selected_tool: 'NONE',
          reason: 'No active upcoming appointment was found to modify.',
          result: { status: 'FAILED_NOT_FOUND', message: 'No upcoming appointment found.' },
        };
      }
      if (state.state === 'CONFIRMED' && state.time) {
        Logger.info(`Orchestrator executing changeTime for CallSid: ${callSid}`, 'ORCHESTRATOR');
        const changeResult = await changeTime(callSid, state.activeAppointmentId, state.time, hospitalId);
        broadcastToDashboard({ type: 'REFRESH_DASHBOARD' });
        return {
          selected_tool: 'CHANGE_TIME',
          reason: 'Time change confirmed by user.',
          result: changeResult,
        };
      }
      return {
        selected_tool: 'NONE',
        reason: 'Selecting new time or awaiting confirmation.',
        result: state,
      };
    }

    // Read-only / Inquiry operations
    if (state.operation === 'STATUS') {
      return {
        selected_tool: 'APPOINTMENT_STATUS',
        reason: 'Customer inquired about their appointment status.',
        result: { status: 'SUCCESS', activeAppointmentId: state.activeAppointmentId, upcomingAppointments: state.upcomingAppointments },
      };
    }

    if (state.operation === 'UPCOMING') {
      return {
        selected_tool: 'UPCOMING_APPOINTMENTS',
        reason: 'Customer requested upcoming appointments.',
        result: { status: 'SUCCESS', upcomingAppointments: state.upcomingAppointments },
      };
    }

    if (state.operation === 'PAST') {
      return {
        selected_tool: 'PAST_APPOINTMENTS',
        reason: 'Customer requested past appointments.',
        result: { status: 'SUCCESS', pastAppointments: state.pastAppointments },
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
