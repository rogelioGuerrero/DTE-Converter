// Utilidad de Google Analytics para seguimiento de eventos

declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: Record<string, any>) => void;
  }
}

// Eventos de seguimiento para la aplicación DTE
export const analyticsEvents = {
  // Seguimiento de página views
  pageView: (page: string) => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('config', 'G-CJHWVLPBZW', {
        page_path: page
      });
    }
  },

  // Seguimiento de generación de documentos
  documentGenerated: (documentType: string, documentNumber: string) => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'document_generated', {
        document_type: documentType,
        document_number: documentNumber
      });
    }
  },

  // Seguimiento de errores
  error: (errorType: string, errorMessage: string) => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'error', {
        error_type: errorType,
        error_message: errorMessage
      });
    }
  },

  // Seguimiento de acciones del usuario
  userAction: (action: string, category: string, label?: string) => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', action, {
        event_category: category,
        event_label: label
      });
    }
  },

  // Seguimiento de registro/login
  authEvent: (action: 'login' | 'register' | 'logout', method?: string) => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', action, {
        method: method || 'email'
      });
    }
  },

  // Seguimiento de pagos/suscripciones
  paymentEvent: (action: 'purchase' | 'subscription_start' | 'subscription_cancel', value?: number) => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', action, {
        value: value,
        currency: 'USD'
      });
    }
  },

  // Seguimiento de características utilizadas
  featureUsed: (featureName: string) => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'feature_used', {
        feature_name: featureName
      });
    }
  }
};

export default analyticsEvents;
