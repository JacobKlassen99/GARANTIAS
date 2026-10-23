/**
 * REGISTRO DE GARANTÍA DE TERRENOS
 * ASOC. CIVIL "COLONIA CHIHUAHUA"
 *
 * Aplicación profesional para administración de bienes y terrenos en garantía
 * conectada a Google Apps Script y Google Sheets como única fuente real de datos.
 */

import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar, NavSection } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { PWAUpdateBanner } from './components/common/PWAUpdateBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NuevaGarantia } from './pages/NuevaGarantia';
import { GarantiasList } from './pages/GarantiasList';
import { GarantiasLiberadasList } from './pages/GarantiasLiberadasList';
import { ClientesList } from './pages/ClientesList';
import { LotesList } from './pages/LotesList';
import { BienesList } from './pages/BienesList';
import { Reportes } from './pages/Reportes';
import { Configuracion } from './pages/Configuracion';

import { logout, preloadAllData, getLastSyncTime, isSessionActive } from './services/backend';

export default function App() {
  // Estado de autenticación: verifica si existe una sesión activa válida
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isSessionActive());
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastSyncTime());

  // Precargar datos si ya había una sesión iniciada al refrescar
  React.useEffect(() => {
    if (isAuthenticated) {
      preloadAllData().then(() => {
        setLastSyncTime(getLastSyncTime() || 'Conectado');
      }).catch(() => {});
    }
  }, []);

  // Trigger para abrir modales de creación desde accesos rápidos del Dashboard
  const [openNewClienteDirect, setOpenNewClienteDirect] = useState(false);
  const [openNewLoteDirect, setOpenNewLoteDirect] = useState(false);
  const [openNewBienDirect, setOpenNewBienDirect] = useState(false);
  const [initialLoteFilter, setInitialLoteFilter] = useState<string | undefined>(undefined);
  const [initialLoteSearch, setInitialLoteSearch] = useState<string | undefined>(undefined);
  const [initialBienFilter, setInitialBienFilter] = useState<string | undefined>(undefined);
  const [initialBienSearch, setInitialBienSearch] = useState<string | undefined>(undefined);
  const [initialGarantiaSearch, setInitialGarantiaSearch] = useState<string | undefined>(undefined);

  const handleNavigate = (
    sec: NavSection,
    options?: { filterEstado?: string; search?: string }
  ) => {
    if (sec === 'lotes') {
      setInitialLoteFilter(options?.filterEstado);
      setInitialLoteSearch(options?.search);
    }
    if (sec === 'bienes') {
      setInitialBienFilter(options?.filterEstado);
      setInitialBienSearch(options?.search);
    }
    if (sec === 'garantias') {
      setInitialGarantiaSearch(options?.search);
    }
    setCurrentSection(sec);
  };

  const handleLoginSuccess = async () => {
    setIsAuthenticated(true);
    try {
      await preloadAllData();
      setLastSyncTime(getLastSyncTime() || 'Conectado');
    } catch {
      setLastSyncTime(getLastSyncTime() || 'Sin conexión (Modo offline)');
    }
  };

  const handleRefreshData = async () => {
    try {
      await preloadAllData(true);
      setLastSyncTime(getLastSyncTime() || 'Actualizado');
    } catch {
      setLastSyncTime(getLastSyncTime() || 'Error al actualizar');
    }
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setCurrentSection('dashboard');
    setLastSyncTime(null);
  };

  // Si no está autenticado, mostrar la pantalla de acceso
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100 relative">
        <PWAUpdateBanner isFormEditing={false} />
        <Login onSuccessLogin={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans antialiased text-slate-800 overflow-hidden relative">
      <PWAUpdateBanner isFormEditing={currentSection === 'nueva-garantia'} />
      {/* Encabezado Superior (fijo en la parte superior) */}
      <Header
        onLogout={handleLogout}
        institucionName='ASOC. CIVIL "COLONIA CHIHUAHUA"'
        lastSyncTime={lastSyncTime}
        onRefreshData={handleRefreshData}
      />

      {/* Contenedor Principal: Sidebar + Contenido */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Barra Lateral Izquierda (Escritorio) */}
        <Sidebar
          currentSection={currentSection}
          onSelectSection={(sec) => setCurrentSection(sec)}
        />

        {/* Área de Trabajo Principal con desplazamiento independiente */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto pb-20 md:pb-6">
          <div className="max-w-7xl mx-auto w-full">
            <ErrorBoundary>
            {currentSection === 'dashboard' && (
              <Dashboard
                onNavigate={handleNavigate}
                onOpenNuevoCliente={() => {
                  setOpenNewClienteDirect(true);
                  setCurrentSection('clientes');
                }}
                onOpenNuevoLote={() => {
                  setOpenNewLoteDirect(true);
                  setCurrentSection('lotes');
                }}
                onOpenNuevoBien={() => {
                  setOpenNewBienDirect(true);
                  setCurrentSection('bienes');
                }}
              />
            )}

            {currentSection === 'nueva-garantia' && (
              <NuevaGarantia
                onSuccessCreated={() => setCurrentSection('garantias')}
                onNavigate={handleNavigate}
              />
            )}

            {currentSection === 'garantias' && (
              <GarantiasList
                onNavigate={handleNavigate}
                initialSearch={initialGarantiaSearch}
              />
            )}

            {currentSection === 'garantias-liberadas' && (
              <GarantiasLiberadasList onNavigate={handleNavigate} />
            )}

            {currentSection === 'clientes' && (
              <ClientesList
                initialOpenNew={openNewClienteDirect}
                onCloseNew={() => setOpenNewClienteDirect(false)}
              />
            )}

            {currentSection === 'lotes' && (
              <LotesList
                initialOpenNew={openNewLoteDirect}
                onCloseNew={() => setOpenNewLoteDirect(false)}
                initialFilterEstado={initialLoteFilter}
                initialSearch={initialLoteSearch}
              />
            )}

            {currentSection === 'bienes' && (
              <BienesList
                initialOpenNew={openNewBienDirect}
                onCloseNew={() => setOpenNewBienDirect(false)}
                initialFilterEstado={initialBienFilter}
                initialSearch={initialBienSearch}
              />
            )}

            {currentSection === 'reportes' && <Reportes />}

            {currentSection === 'configuracion' && <Configuracion />}
          </ErrorBoundary>
        </div>
      </main>
    </div>

      {/* Barra de Navegación Inferior (Teléfono) */}
      <BottomNav
        currentSection={currentSection}
        onSelectSection={(sec) => setCurrentSection(sec)}
      />

      {/* Indicador de Conexión Offline para PWA */}
      <OfflineIndicator />
    </div>
  );
}
