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
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NuevaGarantia } from './pages/NuevaGarantia';
import { GarantiasList } from './pages/GarantiasList';
import { ClientesList } from './pages/ClientesList';
import { LotesList } from './pages/LotesList';
import { BienesList } from './pages/BienesList';
import { Reportes } from './pages/Reportes';
import { Configuracion } from './pages/Configuracion';

import { logout } from './services/backend';

export default function App() {
  // Estado de autenticación en memoria (NO se guarda permanentemente en localStorage)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');

  // Trigger para abrir modales de creación desde accesos rápidos del Dashboard
  const [openNewClienteDirect, setOpenNewClienteDirect] = useState(false);
  const [openNewLoteDirect, setOpenNewLoteDirect] = useState(false);
  const [openNewBienDirect, setOpenNewBienDirect] = useState(false);

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setCurrentSection('dashboard');
  };

  // Si no está autenticado, mostrar la pantalla de acceso
  if (!isAuthenticated) {
    return <Login onSuccessLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800">
      {/* Encabezado Superior */}
      <Header
        onLogout={handleLogout}
        institucionName='ASOC. CIVIL "COLONIA CHIHUAHUA"'
      />

      {/* Contenedor Principal: Sidebar + Contenido */}
      <div className="flex flex-1 min-h-[calc(100vh-53px)] pb-16 md:pb-0">
        {/* Barra Lateral Izquierda (Escritorio) */}
        <Sidebar
          currentSection={currentSection}
          onSelectSection={(sec) => setCurrentSection(sec)}
        />

        {/* Área de Trabajo Principal */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto max-w-7xl">
          <ErrorBoundary>
            {currentSection === 'dashboard' && (
              <Dashboard
                onNavigate={(sec) => setCurrentSection(sec)}
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
                onNavigate={(sec) => setCurrentSection(sec)}
              />
            )}

            {currentSection === 'garantias' && (
              <GarantiasList onNavigate={(sec) => setCurrentSection(sec)} />
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
              />
            )}

            {currentSection === 'bienes' && (
              <BienesList
                initialOpenNew={openNewBienDirect}
                onCloseNew={() => setOpenNewBienDirect(false)}
              />
            )}

            {currentSection === 'reportes' && <Reportes />}

            {currentSection === 'configuracion' && <Configuracion />}
          </ErrorBoundary>
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
