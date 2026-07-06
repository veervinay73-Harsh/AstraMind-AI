import { BookingState } from './stateManager';
import { OrchestratorResult } from './orchestrator';
import { Logger } from '../utils/logger';

export const generateVoiceResponse = async (
  _userUtterance: string,
  state: BookingState,
  orchestratorResult: OrchestratorResult,
  callSid?: string,
  stateBefore?: BookingState
): Promise<string> => {
  try {
    Logger.info(`[RESPONSE_GENERATOR] Programmatic response generation for Session ID: "${callSid || 'N/A'}" -> Operation: "${state.operation || 'N/A'}", Patient: "${state.patient_name || 'N/A'}", Phone: "${state.phone || 'N/A'}", Doctor: "${state.doctor || 'N/A'}"`, 'RESPONSE_GENERATOR');

    // 1. Check successful business tool outcomes first
    if (orchestratorResult.selected_tool !== 'NONE') {
      const tool = orchestratorResult.selected_tool;
      const res = orchestratorResult.result || {};

      if (tool === 'BOOK_APPOINTMENT') {
        if (res.status === 'BOOKED' || res.appointmentId) {
          return `Your appointment has been successfully confirmed. Thank you for choosing AstraMind Integrated Medical Center. We look forward to seeing you on ${res.date || state.date} at ${res.time || state.time}. Have a wonderful day.`;
        }
        if (res.status === 'FAILED_DOCTOR_NOT_FOUND') {
          return `I couldn't find the doctor you requested. Please let me know which doctor or department you would like to see.`;
        }
        return `I'm sorry, I encountered an issue booking your appointment: ${res.message || 'Internal error'}.`;
      }

      if (tool === 'CANCEL_APPOINTMENT') {
        if (res.status === 'CANCELLED' || res.appointmentId) {
          return `Your appointment has been cancelled successfully. Thank you for contacting AstraMind.`;
        }
        return `I couldn't cancel your appointment: ${res.message || 'Appointment not found'}.`;
      }

      if (tool === 'RESCHEDULE_APPOINTMENT') {
        if (res.status === 'RESCHEDULED' || res.appointmentId) {
          return `Your appointment has been successfully rescheduled with ${res.doctor || state.doctor || 'your doctor'} to ${res.new_date || state.date} at ${res.new_time || state.time}. We look forward to seeing you.`;
        }
        return `I couldn't reschedule your appointment: ${res.message || 'Internal error'}.`;
      }

      if (tool === 'CHANGE_DOCTOR') {
        if (res.status === 'SUCCESS' || res.appointmentId) {
          return `The doctor for your appointment has been successfully changed to ${res.doctor || state.doctor}.`;
        }
        return `I couldn't change the doctor: ${res.message || 'Internal error'}.`;
      }

      if (tool === 'CHANGE_DATE') {
        if (res.status === 'SUCCESS' || res.appointmentId) {
          return `The date of your appointment has been successfully changed to ${res.date || state.date}.`;
        }
        return `I couldn't change the date: ${res.message || 'Internal error'}.`;
      }

      if (tool === 'CHANGE_TIME') {
        if (res.status === 'SUCCESS' || res.appointmentId) {
          return `The time of your appointment has been successfully changed to ${res.time || state.time}.`;
        }
        return `I couldn't change the time: ${res.message || 'Internal error'}.`;
      }

      if (tool === 'APPOINTMENT_STATUS') {
        const upcoming = res.upcomingAppointments || [];
        if (upcoming.length > 0) {
          const first = upcoming[0];
          const d = new Date(first.dateTime);
          const dateStr = d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `Your appointment with ${first.doctorName} on ${dateStr} at ${timeStr} is currently ${first.status.toLowerCase()}.`;
        }
        return `You do not have any upcoming appointments.`;
      }

      if (tool === 'UPCOMING_APPOINTMENTS') {
        const upcoming = res.upcomingAppointments || [];
        if (upcoming.length > 0) {
          const list = upcoming.map((a: any) => {
            const d = new Date(a.dateTime);
            const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `with ${a.doctorName} on ${dateStr} at ${timeStr}`;
          }).join(', and ');
          return `You have the following upcoming appointments: ${list}.`;
        }
        return `You do not have any upcoming appointments.`;
      }

      if (tool === 'PAST_APPOINTMENTS') {
        const past = res.pastAppointments || [];
        if (past.length > 0) {
          const list = past.slice(0, 3).map((a: any) => {
            const d = new Date(a.dateTime);
            const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return `with ${a.doctorName} on ${dateStr}`;
          }).join(', and ');
          return `Your recent past appointments include: ${list}.`;
        }
        return `You do not have any past appointments.`;
      }

      if (tool === 'HOSPITAL_FAQ') {
        if (res.status === 'ANSWER_FOUND') {
          return res.answer;
        }
        return `I'm sorry, I don't have that information. How else can I assist you today?`;
      }

      if (tool === 'HUMAN_HANDOFF') {
        return `Please hold on while I connect you to a human agent.`;
      }
    }

    // 2. If no business tool was executed, guide the slot collection / confirmation flow
    if (state.state === 'CONFIRMATION_REQUIRED') {
      const op = state.operation;
      if (op === 'BOOK') {
        const intro = stateBefore && !stateBefore.time && state.time ? "Great. " : "";
        return `${intro}Here are your appointment details:

Name: ${state.patient_name || 'Not specified'}
Doctor: ${state.doctor || 'Not specified'}
Date: ${state.date || 'Not specified'}
Time: ${state.time || 'Not specified'}

Would you like to confirm your appointment?`;
      }
      if (op === 'CANCEL') {
        return `Would you like to confirm cancelling your upcoming appointment?`;
      }
      if (op === 'RESCHEDULE') {
        return `Would you like to confirm rescheduling your appointment to ${state.date} at ${state.time}?`;
      }
      if (op === 'CHANGE_DOCTOR') {
        return `Would you like to confirm changing your doctor to ${state.doctor}?`;
      }
      if (op === 'CHANGE_DATE') {
        return `Would you like to confirm changing the date of your appointment to ${state.date}?`;
      }
      if (op === 'CHANGE_TIME') {
        return `Would you like to confirm changing the time of your appointment to ${state.time}?`;
      }
    }

    if (state.state === 'COLLECTING_INFORMATION') {
      const missing = state.missing_fields || [];
      if (missing.length > 0) {
        const nextField = missing[0];
        if (nextField === 'patient_name') {
          return `May I know your name, please?`;
        }
        if (nextField === 'phone') {
          return `What is your phone number?`;
        }
        if (nextField === 'department') {
          if (state.invalid_doctor) {
            const recs = (state.recommended_doctors || []).map((d: any) => d.name).join(', ');
            return `I couldn't find ${state.invalid_doctor}. Would you like to see one of our available doctors: ${recs}?`;
          }
          if (state.recommended_doctors && state.recommended_doctors.length > 0) {
            const recs = state.recommended_doctors.map((d: any) => d.name).join(', ');
            return `We have the following doctors available in that specialization: ${recs}. Who would you like to see?`;
          }
          return `Which doctor or department would you like to visit?`;
        }
        if (nextField === 'date') {
          const intro = stateBefore && !stateBefore.doctor && state.doctor ? `Certainly, ${state.patient_name || ''}. ` : "";
          if (state.doctor) {
            return `${intro}What date would you like to book your appointment with ${state.doctor}?`;
          }
          return `${intro}What date would you like to book your appointment?`;
        }
        if (nextField === 'time') {
          const intro = stateBefore && !stateBefore.date && state.date ? "Perfect. " : "";
          return `${intro}What time would you prefer?`;
        }
      }
    }

    if (state.state === 'OTHER') {
      return `Okay, I have cancelled the request. How else can I assist you today?`;
    }

    // 3. Fallback / Welcome state
    if (state.patient_name) {
      if (state.patientExists) {
        return `Welcome back ${state.patient_name}. How can I help you today?`;
      }
      return `Nice to meet you, ${state.patient_name}. How can I help you today?`;
    }
    return `Hello! Welcome to AstraMind Integrated Medical Center. I'm your AI receptionist. May I know your name, please?`;

  } catch (error) {
    Logger.error('Failed to generate programmatic voice response', error, 'RESPONSE_GENERATOR');
    return "I am sorry, I encountered an issue processing your request. Please hold on while I connect you to our support line.";
  }
};
