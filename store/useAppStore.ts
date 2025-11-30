import { create } from 'zustand';
import {
  AdminReport,
  AppNotification,
  ConsultationForm,
  CourseModule,
  DailyLog,
  Lesson,
  UserProfile,
  ViewState
} from '../types';
import { formatDateForDB } from '../services/dataService';

type ToastState = { msg: string; type: 'success' | 'error' } | null;

type TodayLogState = Partial<DailyLog>;

const buildInitialTodayLog = (): TodayLogState => ({
  date: formatDateForDB(new Date()),
  cycleDay: 1,
  symptoms: [],
  alcohol: false,
  activityMinutes: 0,
  sunMinutes: 0,
  lhTest: 'No realizado'
});

const loadDeletedNotifications = (): number[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('fertyfit_deleted_notifications');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

interface AppStore {
  loading: boolean;
  view: ViewState;
  user: UserProfile | null;
  logs: DailyLog[];
  notifications: AppNotification[];
  submittedForms: ConsultationForm[];
  reports: AdminReport[];
  showPhaseModal: boolean;
  currentPhase: number;
  email: string;
  password: string;
  name: string;
  isSignUp: boolean;
  authError: string;
  notif: ToastState;
  courseModules: CourseModule[];
  todayLog: TodayLogState;
  activeLesson: Lesson | null;
  profileTab: 'PROFILE' | 'HISTORIA';
  deletedNotificationIds: number[];
  isEditingProfile: boolean;
  editName: string;
  isEditingF0: boolean;
  f0Answers: Record<string, any>;
  specialistMode: boolean;
  pendingForms: ConsultationForm[];

  setLoading: (loading: boolean) => void;
  setView: (view: ViewState) => void;
  setUser: (user: UserProfile | null) => void;
  setLogs: (logs: DailyLog[]) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  setSubmittedForms: (forms: ConsultationForm[]) => void;
  setReports: (reports: AdminReport[]) => void;
  setShowPhaseModal: (open: boolean) => void;
  setCurrentPhase: (phase: number) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setName: (name: string) => void;
  setIsSignUp: (value: boolean) => void;
  setAuthError: (message: string) => void;
  setNotif: (toast: ToastState) => void;
  setCourseModules: (modules: CourseModule[]) => void;
  setTodayLog: (log: TodayLogState | ((prev: TodayLogState) => TodayLogState)) => void;
  setActiveLesson: (lesson: Lesson | null) => void;
  setProfileTab: (tab: 'PROFILE' | 'HISTORIA') => void;
  setDeletedNotificationIds: (ids: number[]) => void;
  setIsEditingProfile: (editing: boolean) => void;
  setEditName: (name: string) => void;
  setIsEditingF0: (editing: boolean) => void;
  setF0Answers: (answers: Record<string, any>) => void;
  setSpecialistMode: (value: boolean) => void;
  setPendingForms: (forms: ConsultationForm[]) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  loading: true,
  view: 'ONBOARDING',
  user: null,
  logs: [],
  notifications: [],
  submittedForms: [],
  reports: [],
  showPhaseModal: false,
  currentPhase: 0,
  email: '',
  password: '',
  name: '',
  isSignUp: false,
  authError: '',
  notif: null,
  courseModules: [],
  todayLog: buildInitialTodayLog(),
  activeLesson: null,
  profileTab: 'PROFILE',
  deletedNotificationIds: loadDeletedNotifications(),
  isEditingProfile: false,
  editName: '',
  isEditingF0: false,
  f0Answers: {},
  specialistMode: false,
  pendingForms: [],

  setLoading: (loading) => set({ loading }),
  setView: (view) => set({ view }),
  setUser: (user) => set({ user }),
  setLogs: (logs) => set({ logs }),
  setNotifications: (notifications) => set({ notifications }),
  setSubmittedForms: (forms) => set({ submittedForms: forms }),
  setReports: (reports) => set({ reports }),
  setShowPhaseModal: (open) => set({ showPhaseModal: open }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  setName: (name) => set({ name }),
  setIsSignUp: (value) => set({ isSignUp: value }),
  setAuthError: (message) => set({ authError: message }),
  setNotif: (toast) => set({ notif: toast }),
  setCourseModules: (modules) => set({ courseModules: Array.isArray(modules) ? modules : [] }),
  setTodayLog: (log) => set((state) => ({
    todayLog: typeof log === 'function' ? log(state.todayLog) : log
  })),
  setActiveLesson: (lesson) => set({ activeLesson: lesson }),
  setProfileTab: (tab) => set({ profileTab: tab }),
  setDeletedNotificationIds: (ids) => set({ deletedNotificationIds: ids }),
  setIsEditingProfile: (editing) => set({ isEditingProfile: editing }),
  setEditName: (name) => set({ editName: name }),
  setIsEditingF0: (editing) => set({ isEditingF0: editing }),
  setF0Answers: (answers) => set({ f0Answers: answers }),
  setSpecialistMode: (value) => set({ specialistMode: value }),
  setPendingForms: (forms) => set({ pendingForms: forms })
}));

