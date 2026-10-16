import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  Tractor,
} from 'lucide-react';
import {
  Garantia,
  Cliente,
  Lote,
  Bien,
  GarantiaLoteRelacion,
  GarantiaBienRelacion,
  TipoGarantiaCon,
} from '../../types';
import {
  obtenerGarantiaCompleta,
  editarGarantia,
  getClientes,
  getLotes,
  getBienes,
  buscarLotes,
  obtenerLotePorId,
  obtenerDisponibilidadLote,
} from '../../services/backend';
import { ClientSearchAutocomplete } from './ClientSearchAutocomplete';
import { SeleccionarLoteModal } from './SeleccionarLoteModal';
import { SeleccionarBienModal } from './SeleccionarBienModal';
import { formatHectareas, formatPropietario, parseDecimal } from '../../utils/textSearch';
import { analizarAcreedoresItems } from '../../utils/acreedores';

interface EditarGarantiaModalProps {
  idGarantia: string;
  onClose: () => void;
  onSaved: () => void;
}

export const EditarGarantiaModal: React.FC<EditarGarantiaModalProps> = ({
  idGarantia,
  onClose,
  onSaved,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Datos principales
  const [numeroSolicitud, setNumeroSolicitud] = useState('');
  const [fecha, setFecha] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [modalidad, setModalidad] = useState<'Simple' | 'Múltiple'>('Simple');
  const [selectedPrestatario, setSelectedPrestatario] = useState<Cliente | null>(null);
  const [garantiaConTipo, setGarantiaConTipo] = useState<TipoGarantiaCon>('Farmer Rechnung');
  const [selectedGarantiaCliente, setSelectedGarantiaCliente] = useState<Cliente | null>(null);
  const [observacion, setObservacion] = useState('');

  // Items
  const [lotes, setLotes] = useState<GarantiaLoteRelacion[]>([]);
  const [bienes, setBienes] = useState<GarantiaBienRelacion[]>([]);

  // Referencias para agregar
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [availableLotes, setAvailableLotes] = useState<Lote[]>([]);
  const [availableBienes, setAvailableBienes] = useState<Bien[]>([]);

  // Modales de selección unificados
  const [isAddingLote, setIsAddingLote] = useState(false);
  const [isAddingBien, setIsAddingBien] = useState(false);
  const [originalLotes, setOriginalLotes] = useState<{ idLote: string | number; numeroLote?: string; hectareas: number }[]>([]);
  const [originalBienIds, setOriginalBienIds] = useState<(string | number)[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [garantiaFull, cRes, lRes, bRes] = await Promise.all([
          obtenerGarantiaCompleta(idGarantia, false),
          getClientes({ page: 1, pageSize: 1000 }),
          getLotes({ page: 1, pageSize: 1000 }),
          getBienes({ page: 1, pageSize: 1000 }),
        ]);

        if (!isMounted) return;

        const cList = Array.isArray(cRes?.data) ? cRes.data : [];
        const lList = Array.isArray(lRes?.data) ? lRes.data : [];
        const bList = Array.isArray(bRes?.data) ? bRes.data : [];

        setClientesList(cList);
        setAvailableLotes(lList);
        setAvailableBienes(bList);

        if (garantiaFull) {
          setNumeroSolicitud(garantiaFull.numeroSolicitud || '');
          setFecha(garantiaFull.fecha ? garantiaFull.fecha.split('T')[0] : '');
          setFechaVencimiento(
            garantiaFull.fechaVencimiento ? garantiaFull.fechaVencimiento.split('T')[0] : ''
          );
          setModalidad(garantiaFull.modalidad === 'Múltiple' ? 'Múltiple' : 'Simple');
          setSelectedPrestatario({
            cuenta: garantiaFull.cuentaPrestatario,
            nombre: garantiaFull.prestatario,
            ci: '',
          });

          // Determinar de forma segura y precisa el acreedor general (garantiaCon)
          const rawTipo = (garantiaFull.garantiaConTipo || '').trim();
          const rawCuenta = String(garantiaFull.garantiaConCuenta || '').trim();
          const rawNombre = (garantiaFull.garantiaConNombre || '').trim();
          const prestatarioCuenta = String(garantiaFull.cuentaPrestatario || '').trim();

          let resolvedTipo: TipoGarantiaCon = 'Farmer Rechnung';
          let resolvedCliente: Cliente | null = null;

          if (rawNombre === 'Farmer Rechnung' || rawTipo === 'Farmer Rechnung' || rawNombre.includes('Farmer')) {
            resolvedTipo = 'Farmer Rechnung';
          } else if (rawNombre === 'Campo Grande' || rawTipo === 'Campo Grande' || rawNombre.includes('Campo')) {
            resolvedTipo = 'Campo Grande';
          } else if (rawCuenta && rawCuenta !== prestatarioCuenta) {
            const matchedClient = cList.find((c) => String(c.cuenta).trim() === rawCuenta);
            if (matchedClient) {
              resolvedTipo = 'Cliente';
              resolvedCliente = matchedClient;
            } else {
              resolvedTipo = 'Cliente';
              resolvedCliente = {
                cuenta: rawCuenta,
                nombre: rawNombre || `Cliente ${rawCuenta}`,
                ci: '',
              };
            }
          } else if (rawNombre && rawNombre !== 'Clientes Particulares Múltiples') {
            const matchedByName = cList.find((c) => c.nombre.toLowerCase().trim() === rawNombre.toLowerCase());
            if (matchedByName) {
              resolvedTipo = 'Cliente';
              resolvedCliente = matchedByName;
            } else if (rawNombre.includes('Campo')) {
              resolvedTipo = 'Campo Grande';
            } else {
              resolvedTipo = 'Farmer Rechnung';
            }
          } else {
            // Fallback para modalidad múltiple sin cuenta asignada
            const rawLotesList = Array.isArray(garantiaFull.lotes) ? garantiaFull.lotes : [];
            const rawBienesList = Array.isArray(garantiaFull.bienes) ? garantiaFull.bienes : [];
            const primerLote = rawLotesList[0];
            const primerBien = rawBienesList[0];
            const pTipo = primerLote?.garantiaConTipo || primerBien?.garantiaConTipo;
            const pNombre = primerLote?.garantiaConNombre || primerBien?.garantiaConNombre;

            if (pTipo === 'Campo Grande' || pNombre === 'Campo Grande') {
              resolvedTipo = 'Campo Grande';
            } else if (pTipo === 'Farmer Rechnung' || pNombre === 'Farmer Rechnung') {
              resolvedTipo = 'Farmer Rechnung';
            } else if (pNombre && pNombre !== 'Clientes Particulares Múltiples') {
              const matchedClient = cList.find((c) => `${c.cuenta} — ${c.nombre}` === pNombre || c.nombre === pNombre);
              if (matchedClient) {
                resolvedTipo = 'Cliente';
                resolvedCliente = matchedClient;
              } else {
                resolvedTipo = 'Farmer Rechnung';
              }
            } else {
              resolvedTipo = 'Farmer Rechnung';
            }
          }

          setGarantiaConTipo(resolvedTipo);
          setSelectedGarantiaCliente(resolvedCliente);

          setObservacion(garantiaFull.observacion || '');

          const rawLotes = Array.isArray(garantiaFull.lotes) ? garantiaFull.lotes : [];

          // Correlacionar lotes con la base de datos real (hoja lotes) para obtener ID Lote real y N.º de Lote
          const lotesEnriquecidos = await Promise.all(
            rawLotes.map(async (lote) => {
              let masterLote = lList.find((l) => {
                const matchId = lote.idLote && String(l.idLote).trim().toLowerCase() === String(lote.idLote).trim().toLowerCase();
                const matchNum = lote.numeroLote && String(l.numeroLote).trim().toLowerCase() === String(lote.numeroLote).trim().toLowerCase();
                const matchCross1 = lote.idLote && String(l.numeroLote).trim().toLowerCase() === String(lote.idLote).trim().toLowerCase();
                const matchCross2 = lote.numeroLote && String(l.idLote).trim().toLowerCase() === String(lote.numeroLote).trim().toLowerCase();
                return matchId || matchNum || matchCross1 || matchCross2;
              });

              if (!masterLote && (lote.numeroLote || lote.idLote)) {
                if (lote.idLote) {
                  masterLote = (await obtenerLotePorId(String(lote.idLote)).catch(() => null)) || undefined;
                }
                if (!masterLote && lote.numeroLote) {
                  const found = await buscarLotes(String(lote.numeroLote), true).catch(() => []);
                  masterLote = found.find((l) =>
                    String(l.numeroLote).trim().toLowerCase() === String(lote.numeroLote).trim().toLowerCase() ||
                    String(l.idLote).trim().toLowerCase() === String(lote.numeroLote).trim().toLowerCase()
                  );
                }
              }

              const officialId = masterLote ? masterLote.idLote : lote.idLote;
              const officialNumero = masterLote ? masterLote.numeroLote : lote.numeroLote;
              const officialHaTotales = masterLote ? masterLote.hectareas : (lote.hectareasTotales || lote.hectareas);
              const cta = lote.cuentaPropietario ?? masterLote?.cuentaPropietario ?? '';
              const prop = lote.propietario || masterLote?.propietario || '';

              // Obtener disponibilidad real de este lote para esta garantía
              let dispParaEsta = officialHaTotales;
              let haEnOtras = 0;
              try {
                const dispInfo = await obtenerDisponibilidadLote(
                  {
                    idLote: officialId,
                    numeroLote: officialNumero,
                    hectareas: officialHaTotales,
                    cuentaPropietario: cta,
                    propietario: prop,
                  },
                  idGarantia
                );
                dispParaEsta = dispInfo.hectareasDisponiblesParaEstaGarantia;
                haEnOtras = dispInfo.hectareasEnOtrasGarantias;
              } catch (e) {
                console.warn('Error obteniendo disponibilidad para lote', officialNumero, e);
              }

              let itemTipo: TipoGarantiaCon = 'Farmer Rechnung';
              let itemCuenta: string = '';
              let itemNombre = 'Farmer Rechnung';

              const lTipo = (lote.garantiaConTipo || '').trim();
              const lNombre = (lote.garantiaConNombre || '').trim();
              const lCuenta = String(lote.garantiaConCuenta || '').trim();

              if (lTipo === 'Farmer Rechnung' || lNombre === 'Farmer Rechnung' || lNombre.includes('Farmer')) {
                itemTipo = 'Farmer Rechnung';
                itemCuenta = '';
                itemNombre = 'Farmer Rechnung';
              } else if (lTipo === 'Campo Grande' || lNombre === 'Campo Grande' || lNombre.includes('Campo')) {
                itemTipo = 'Campo Grande';
                itemCuenta = '';
                itemNombre = 'Campo Grande';
              } else if (lTipo === 'Cliente' || lCuenta) {
                itemTipo = 'Cliente';
                itemCuenta = lCuenta;
                const matched = cList.find((c) => String(c.cuenta).trim() === lCuenta);
                itemNombre = matched ? `${matched.cuenta} — ${matched.nombre}` : (lNombre || (lCuenta ? `Cliente ${lCuenta}` : 'Cliente'));
              } else {
                itemTipo = 'Farmer Rechnung';
                itemCuenta = '';
                itemNombre = 'Farmer Rechnung';
              }

              return {
                ...lote,
                idLote: officialId,
                numeroLote: officialNumero,
                hectareas: Number(lote.hectareas) || 0,
                hectareasTotales: officialHaTotales,
                hectareasDisponibles: dispParaEsta,
                hectareasMaxPermitidas: dispParaEsta,
                hectareasEnOtrasGarantias: haEnOtras,
                propietario: prop,
                cuentaPropietario: cta,
                garantiaConTipo: itemTipo,
                garantiaConCuenta: itemCuenta,
                garantiaConNombre: itemNombre,
              };
            })
          );

          // Verificar si alguna relación no tiene hectáreas válidas
          const loteSinHaValidas = lotesEnriquecidos.find((l) => l.hectareasIndeterminadas || Number(l.hectareas) <= 0);
          if (loteSinHaValidas) {
            setErrorMessage(
              `No se pudieron determinar las hectáreas guardadas en garantia_lotes para el lote ${loteSinHaValidas.numeroLote || loteSinHaValidas.idLote}. Para proteger los datos reales, se ha bloqueado el guardado.`
            );
          }

          setOriginalLotes(
            lotesEnriquecidos.map((l) => ({
              idLote: l.idLote,
              numeroLote: l.numeroLote,
              hectareas: Number(l.hectareas) || 0,
            }))
          );
          setLotes(lotesEnriquecidos);

          const rawBienes = Array.isArray(garantiaFull.bienes) ? garantiaFull.bienes : [];
          setOriginalBienIds(rawBienes.map((b) => b.idBien));
          const bienesEnriquecidos = rawBienes.map((bien) => {
            const masterBien = bList.find((b) => String(b.idBien) === String(bien.idBien));

            let itemTipo: TipoGarantiaCon = 'Farmer Rechnung';
            let itemCuenta: string = '';
            let itemNombre = 'Farmer Rechnung';

            const bTipo = (bien.garantiaConTipo || '').trim();
            const bNombre = (bien.garantiaConNombre || '').trim();
            const bCuenta = String(bien.garantiaConCuenta || '').trim();

            if (bTipo === 'Farmer Rechnung' || bNombre === 'Farmer Rechnung' || bNombre.includes('Farmer')) {
              itemTipo = 'Farmer Rechnung';
              itemCuenta = '';
              itemNombre = 'Farmer Rechnung';
            } else if (bTipo === 'Campo Grande' || bNombre === 'Campo Grande' || bNombre.includes('Campo')) {
              itemTipo = 'Campo Grande';
              itemCuenta = '';
              itemNombre = 'Campo Grande';
            } else if (bTipo === 'Cliente' || bCuenta) {
              itemTipo = 'Cliente';
              itemCuenta = bCuenta;
              const matched = cList.find((c) => String(c.cuenta).trim() === bCuenta);
              itemNombre = matched ? `${matched.cuenta} — ${matched.nombre}` : (bNombre || (bCuenta ? `Cliente ${bCuenta}` : 'Cliente'));
            } else {
              itemTipo = 'Farmer Rechnung';
              itemCuenta = '';
              itemNombre = 'Farmer Rechnung';
            }

            return {
              ...bien,
              propietario: bien.propietario || masterBien?.propietario || '',
              cuentaPropietario: bien.cuentaPropietario ?? masterBien?.cuentaPropietario ?? '',
              garantiaConTipo: itemTipo,
              garantiaConCuenta: itemCuenta,
              garantiaConNombre: itemNombre,
            };
          });
          setBienes(bienesEnriquecidos);
        } else {
          setErrorMessage('No se pudo encontrar la garantía seleccionada.');
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage(err.message || 'Error cargando datos.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAll();
    return () => {
      isMounted = false;
    };
  }, [idGarantia]);

  const totalHectareas = lotes.reduce((acc, l) => acc + (Number(l.hectareas) || 0), 0);
  const totalValorUSD = bienes.reduce((acc, b) => acc + (Number(b.valorGarantiaUSD) || 0), 0);

  const handleRemoveLote = (idLote: string) => {
    setLotes((prev) => prev.filter((l) => l.idLote !== idLote));
  };

  const handleRemoveBien = (idBien: string) => {
    setBienes((prev) => prev.filter((b) => b.idBien !== idBien));
  };

  const handleSelectLoteFromModal = (loteRel: GarantiaLoteRelacion) => {
    setLotes((prev) => [
      ...prev.filter((l) => String(l.idLote) !== String(loteRel.idLote)),
      { ...loteRel, idGarantia },
    ]);
  };

  const handleSelectBienFromModal = (bienRel: GarantiaBienRelacion) => {
    setBienes((prev) => [
      ...prev.filter((b) => String(b.idBien) !== String(bienRel.idBien)),
      { ...bienRel, idGarantia },
    ]);
  };

  // Analizar acreedores en todos los ítems actuales (lotes y bienes)
  const resumenAcreedores = useMemo(() => {
    return analizarAcreedoresItems(lotes, bienes);
  }, [lotes, bienes]);

  // Determinar qué botón visual debe aparecer como seleccionado en la cabecera
  const activeAcreedorTipo: TipoGarantiaCon | 'Multiple' = useMemo(() => {
    if (modalidad === 'Múltiple') {
      if (resumenAcreedores.esMultiple) {
        return 'Multiple';
      }
      if (resumenAcreedores.tieneItems && resumenAcreedores.acreedorUnico) {
        return resumenAcreedores.acreedorUnico.tipo;
      }
    }
    return garantiaConTipo;
  }, [modalidad, resumenAcreedores, garantiaConTipo]);

  // Sincronizar automáticamente el cliente del selector superior si todos los ítems comparten un único cliente
  useEffect(() => {
    if (
      modalidad === 'Múltiple' &&
      resumenAcreedores.tieneItems &&
      !resumenAcreedores.esMultiple &&
      resumenAcreedores.acreedorUnico?.tipo === 'Cliente'
    ) {
      const cta = resumenAcreedores.acreedorUnico.cuenta;
      if (cta && String(selectedGarantiaCliente?.cuenta) !== String(cta)) {
        const found = clientesList.find((c) => String(c.cuenta).trim() === String(cta).trim());
        if (found) {
          setSelectedGarantiaCliente(found);
        } else {
          setSelectedGarantiaCliente({
            cuenta: cta,
            nombre: resumenAcreedores.acreedorUnico.nombre || `Cliente ${cta}`,
            ci: '',
          });
        }
      }
    }
  }, [modalidad, resumenAcreedores, clientesList]);

  const handleSelectHeaderCreditor = (tipo: TipoGarantiaCon) => {
    setGarantiaConTipo(tipo);
    if (tipo !== 'Cliente') {
      setSelectedGarantiaCliente(null);
    }
    // Si la modalidad es Múltiple y todos los ítems tenían un único acreedor, permitir actualizar todos al nuevo tipo
    if (modalidad === 'Múltiple' && lotes.length + bienes.length > 0 && !resumenAcreedores.esMultiple) {
      setLotes((prev) =>
        prev.map((l) => ({
          ...l,
          garantiaConTipo: tipo,
          garantiaConCuenta: tipo === 'Cliente' ? (selectedGarantiaCliente ? String(selectedGarantiaCliente.cuenta) : '') : '',
          garantiaConNombre: tipo === 'Cliente' ? (selectedGarantiaCliente ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}` : '') : tipo,
        }))
      );
      setBienes((prev) =>
        prev.map((b) => ({
          ...b,
          garantiaConTipo: tipo,
          garantiaConCuenta: tipo === 'Cliente' ? (selectedGarantiaCliente ? String(selectedGarantiaCliente.cuenta) : '') : '',
          garantiaConNombre: tipo === 'Cliente' ? (selectedGarantiaCliente ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}` : '') : tipo,
        }))
      );
    }
  };

  const handleSelectHeaderClient = (client: Cliente | null) => {
    setSelectedGarantiaCliente(client);
    if (modalidad === 'Múltiple' && client && !resumenAcreedores.esMultiple) {
      const cta = String(client.cuenta);
      const nom = `${client.cuenta} — ${client.nombre}`;
      setLotes((prev) =>
        prev.map((l) => ({
          ...l,
          garantiaConTipo: 'Cliente',
          garantiaConCuenta: cta,
          garantiaConNombre: nom,
        }))
      );
      setBienes((prev) =>
        prev.map((b) => ({
          ...b,
          garantiaConTipo: 'Cliente',
          garantiaConCuenta: cta,
          garantiaConNombre: nom,
        }))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedPrestatario) {
      setErrorMessage('Debe especificar el Prestatario.');
      return;
    }
    if (lotes.length === 0 && bienes.length === 0) {
      setErrorMessage('Debe contar con al menos un lote o bien en garantía.');
      return;
    }

    if (modalidad === 'Simple' && garantiaConTipo === 'Cliente') {
      if (!selectedGarantiaCliente) {
        setErrorMessage('Ha seleccionado "Cliente registrado" como acreedor, debe especificar el cliente.');
        return;
      }
      if (String(selectedGarantiaCliente.cuenta).trim() === String(selectedPrestatario.cuenta).trim()) {
        setErrorMessage('El acreedor (Garantía con) no puede ser la misma cuenta del Prestatario.');
        return;
      }
    }

    for (const l of lotes) {
      const haVal = Number(l.hectareas) || 0;
      if (l.hectareasMaxPermitidas !== undefined && haVal > l.hectareasMaxPermitidas + 1e-6) {
        const enOtras = l.hectareasEnOtrasGarantias ? ` (${formatHectareas(l.hectareasEnOtrasGarantias)} ha comprometidas en otra garantía)` : '';
        setErrorMessage(
          `El lote ${l.numeroLote || l.idLote} solo tiene ${formatHectareas(l.hectareasMaxPermitidas)} ha disponibles para esta garantía${enOtras}.`
        );
        return;
      }
      if (l.garantiaConTipo === 'Cliente') {
        if (!l.garantiaConCuenta || !String(l.garantiaConCuenta).trim()) {
          setErrorMessage(`El lote ${l.numeroLote || l.idLote} tiene acreedor Cliente sin número de cuenta`);
          return;
        }
        if (String(l.garantiaConCuenta).trim() === String(selectedPrestatario.cuenta).trim()) {
          setErrorMessage(`El lote ${l.numeroLote || l.idLote} tiene como acreedor la misma cuenta del Prestatario. Seleccione un acreedor válido.`);
          return;
        }
      }
    }

    for (const b of bienes) {
      if (b.garantiaConTipo === 'Cliente') {
        if (!b.garantiaConCuenta || !String(b.garantiaConCuenta).trim()) {
          setErrorMessage(`El bien ${b.numeroPoliza || b.idBien} tiene acreedor Cliente sin número de cuenta`);
          return;
        }
        if (String(b.garantiaConCuenta).trim() === String(selectedPrestatario.cuenta).trim()) {
          setErrorMessage(`El bien ${b.numeroPoliza || b.idBien} tiene como acreedor la misma cuenta del Prestatario. Seleccione un acreedor válido.`);
          return;
        }
      }
    }

    const gNombre =
      garantiaConTipo === 'Cliente' && selectedGarantiaCliente
        ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}`
        : garantiaConTipo;

    const gCuenta =
      garantiaConTipo === 'Cliente' && selectedGarantiaCliente
        ? selectedGarantiaCliente.cuenta
        : undefined;

    const tipoGarantiaCalculado =
      lotes.length > 0 && bienes.length > 0
        ? 'Terrenos y Bienes'
        : lotes.length > 0
        ? 'Terreno'
        : 'Bien';

    // Obtener consolidado de propietarios únicos a partir de los lotes y bienes
    const ownersMap = new Map<string, { cuenta: string | number; nombre: string }>();

    for (const l of lotes) {
      const pNombre = (l.propietario || '').trim();
      const pCuenta =
        l.cuentaPropietario !== undefined && l.cuentaPropietario !== null
          ? String(l.cuentaPropietario).trim()
          : '';
      if (pNombre || pCuenta) {
        const key = pCuenta ? `cta:${pCuenta}` : `nom:${pNombre}`;
        if (!ownersMap.has(key)) {
          ownersMap.set(key, { cuenta: l.cuentaPropietario ?? '', nombre: pNombre });
        }
      }
    }

    for (const b of bienes) {
      const pNombre = (b.propietario || '').trim();
      const pCuenta =
        b.cuentaPropietario !== undefined && b.cuentaPropietario !== null
          ? String(b.cuentaPropietario).trim()
          : '';
      if (pNombre || pCuenta) {
        const key = pCuenta ? `cta:${pCuenta}` : `nom:${pNombre}`;
        if (!ownersMap.has(key)) {
          ownersMap.set(key, { cuenta: b.cuentaPropietario ?? '', nombre: pNombre });
        }
      }
    }

    const distinctOwners = Array.from(ownersMap.values());
    let mainPropNombre = '—';
    let mainPropCuenta: string | number = '';
    if (distinctOwners.length === 1) {
      mainPropNombre = distinctOwners[0].nombre;
      mainPropCuenta = distinctOwners[0].cuenta;
    } else if (distinctOwners.length > 1) {
      mainPropNombre = distinctOwners.map((o) => o.nombre || `Cuenta ${o.cuenta}`).join(' / ');
      const firstValidOwner = distinctOwners.find((o) => o.cuenta !== undefined && o.cuenta !== null && String(o.cuenta).trim() !== '');
      mainPropCuenta = firstValidOwner ? firstValidOwner.cuenta : (distinctOwners[0]?.cuenta || selectedPrestatario?.cuenta || '');
    }

    setIsSaving(true);
    try {
      // Determinar la cabecera técnica
      let headerTipo: TipoGarantiaCon = 'Farmer Rechnung';
      let headerCuenta: string | undefined = undefined;
      let headerNombre = 'Farmer Rechnung';

      if (modalidad === 'Simple') {
        if (garantiaConTipo === 'Campo Grande') {
          headerTipo = 'Campo Grande';
          headerCuenta = undefined;
          headerNombre = 'Campo Grande';
        } else if (garantiaConTipo === 'Cliente' && selectedGarantiaCliente?.cuenta) {
          headerTipo = 'Cliente';
          headerCuenta = String(selectedGarantiaCliente.cuenta);
          headerNombre = `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}`;
        } else {
          headerTipo = 'Farmer Rechnung';
          headerCuenta = undefined;
          headerNombre = 'Farmer Rechnung';
        }
      } else {
        // Modalidad Múltiple
        if (resumenAcreedores.tieneItems && !resumenAcreedores.esMultiple && resumenAcreedores.acreedorUnico) {
          if (resumenAcreedores.acreedorUnico.tipo === 'Campo Grande') {
            headerTipo = 'Campo Grande';
            headerCuenta = undefined;
            headerNombre = 'Campo Grande';
          } else if (resumenAcreedores.acreedorUnico.tipo === 'Cliente' && resumenAcreedores.acreedorUnico.cuenta) {
            headerTipo = 'Cliente';
            headerCuenta = resumenAcreedores.acreedorUnico.cuenta;
            headerNombre = resumenAcreedores.acreedorUnico.nombre || `Cliente ${resumenAcreedores.acreedorUnico.cuenta}`;
          } else {
            headerTipo = 'Farmer Rechnung';
            headerCuenta = undefined;
            headerNombre = 'Farmer Rechnung';
          }
        } else {
          // Múltiples acreedores diferentes: la cabecera técnica es una institución real (Farmer Rechnung con cuenta vacía)
          // NUNCA enviar 'Cliente' con cuenta vacía a Apps Script
          headerTipo = 'Farmer Rechnung';
          headerCuenta = undefined;
          headerNombre = 'Farmer Rechnung';
        }
      }

      const payload: Partial<Garantia> = {
        idGarantia,
        numeroSolicitud: numeroSolicitud.trim(),
        fecha,
        fechaVencimiento: fechaVencimiento || '',
        cuentaPropietario: mainPropCuenta,
        propietario: mainPropNombre,
        cuentaPrestatario: selectedPrestatario.cuenta,
        prestatario: selectedPrestatario.nombre,
        garantiaConTipo: headerTipo,
        garantiaConCuenta: headerCuenta,
        garantiaConNombre: headerNombre,
        tipoGarantia: tipoGarantiaCalculado,
        modalidad,
        observacion: observacion.trim(),
        lotes,
        bienes,
      };

      await editarGarantia(payload);
      setSuccessMessage('Garantía actualizada correctamente.');
      setTimeout(() => {
        onSaved();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo guardar la edición.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-2xs overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Editar Garantía — Solicitud N.º {numeroSolicitud || idGarantia}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
            <p>Cargando datos completos de la garantía...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2 text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-emerald-900 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* SECCIÓN 1: DATOS GENERALES */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-3">
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-800" />
                <span>Datos Generales de la Solicitud</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    N.º de Solicitud
                  </label>
                  <input
                    type="text"
                    value={numeroSolicitud}
                    onChange={(e) => setNumeroSolicitud(e.target.value)}
                    placeholder="Ej. 7097"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Fecha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700 text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Fecha de Vencimiento
                    </label>
                    {fechaVencimiento && (
                      <button
                        type="button"
                        onClick={() => setFechaVencimiento('')}
                        className="text-[10px] text-red-600 hover:text-red-800 underline cursor-pointer"
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Modalidad
                  </label>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setModalidad('Simple')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded border transition ${
                        modalidad === 'Simple'
                          ? 'bg-emerald-800 text-white border-emerald-900'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Simple
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalidad('Múltiple')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded border transition ${
                        modalidad === 'Múltiple'
                          ? 'bg-emerald-800 text-white border-emerald-900'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Múltiple
                    </button>
                  </div>
                </div>
              </div>

              {/* Prestatario */}
              <div className="pt-2">
                <ClientSearchAutocomplete
                  label="Prestatario (Cuenta en Garantía)"
                  clientesList={clientesList}
                  selectedCuenta={selectedPrestatario?.cuenta}
                  onSelect={setSelectedPrestatario}
                  required
                />
              </div>

              {/* Garantía con (General / Predeterminado) */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {modalidad === 'Múltiple'
                    ? resumenAcreedores.esMultiple
                      ? 'Acreedor de la Garantía (Múltiples asignaciones individuales):'
                      : 'Seleccione el acreedor por defecto (en modalidad múltiple, cada elemento puede personalizarse):'
                    : 'Garantía Constituida Con'}
                </label>
                <div
                  className={`grid ${
                    modalidad === 'Múltiple' && resumenAcreedores.esMultiple
                      ? 'grid-cols-2 sm:grid-cols-4'
                      : 'grid-cols-3'
                  } gap-2`}
                >
                  {(['Farmer Rechnung', 'Campo Grande', 'Cliente'] as TipoGarantiaCon[]).map((tipo) => {
                    const isDisabled = modalidad === 'Múltiple' && resumenAcreedores.esMultiple;
                    const isSelected = !isDisabled && activeAcreedorTipo === tipo;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectHeaderCreditor(tipo)}
                        className={`py-1.5 px-2 text-xs font-semibold rounded border transition text-center ${
                          isDisabled
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs cursor-pointer'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        {tipo === 'Cliente' ? 'Cliente registrado' : tipo}
                      </button>
                    );
                  })}

                  {modalidad === 'Múltiple' && resumenAcreedores.esMultiple && (
                    <button
                      type="button"
                      disabled
                      className="py-1.5 px-2 text-xs font-bold rounded border transition text-center bg-emerald-800 text-white border-emerald-900 shadow-2xs cursor-default flex items-center justify-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Múltiples acreedores</span>
                    </button>
                  )}
                </div>

                {modalidad === 'Múltiple' && resumenAcreedores.esMultiple && (
                  <p className="mt-1.5 text-[10px] text-slate-500 italic">
                    Los ítems de esta garantía tienen diferentes acreedores asignados de forma individual. Modifique el acreedor directamente en cada fila si desea cambiarlo.
                  </p>
                )}

                {(!resumenAcreedores.esMultiple || modalidad === 'Simple') && activeAcreedorTipo === 'Cliente' && (
                  <div className="pt-2">
                    <ClientSearchAutocomplete
                      label="Cliente Receptor de la Garantía"
                      clientesList={clientesList}
                      selectedCuenta={selectedGarantiaCliente?.cuenta}
                      onSelect={handleSelectHeaderClient}
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: LISTA DE ITEMS (LOTES Y BIENES) */}
            <div className="p-3.5 bg-white border border-slate-300 rounded space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Items en Garantía ({lotes.length + bienes.length})</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingLote(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Lote</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingBien(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-100 hover:bg-blue-200 rounded border border-blue-300 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Bien</span>
                  </button>
                </div>
              </div>

              {/* TABLA COMPACTA DE ITEMS */}
              <div className="border border-slate-200 rounded overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-1.5 border-r border-slate-200">Bien / Lote</th>
                      <th className="p-1.5 border-r border-slate-200">Propietario</th>
                      <th className="p-1.5 border-r border-slate-200 text-right">Cantidad / Valor</th>
                      <th className="p-1.5 border-r border-slate-200">Garantía con</th>
                      <th className="p-1.5 text-center w-16">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotes.map((lote) => (
                      <tr key={`l-${lote.idLote}`} className="hover:bg-slate-50">
                        <td className="p-1.5 border-r border-slate-200 font-mono font-bold text-emerald-950">
                          Lote {lote.numeroLote}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-slate-800 font-medium">
                          {formatPropietario(lote.propietario, lote.cuentaPropietario)}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-900">
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={lote.hectareasMaxPermitidas}
                                value={lote.hectareas}
                                onChange={(e) => {
                                  const val = parseDecimal(e.target.value);
                                  setLotes((prev) =>
                                    prev.map((item) =>
                                      item.idLote === lote.idLote ? { ...item, hectareas: val } : item
                                    )
                                  );
                                }}
                                className={`w-24 px-1.5 py-0.5 text-right font-mono border rounded text-xs ${
                                  lote.hectareasMaxPermitidas !== undefined && Number(lote.hectareas) > lote.hectareasMaxPermitidas + 1e-6
                                    ? 'border-red-500 bg-red-50 text-red-900 font-bold'
                                    : 'border-slate-300'
                                }`}
                              />{' '}
                              <span>ha</span>
                            </div>
                            {lote.hectareasMaxPermitidas !== undefined && (
                              <div className="text-[10px] text-slate-500 font-sans mt-0.5 flex flex-col items-end">
                                <span>Máx. disp: {formatHectareas(lote.hectareasMaxPermitidas)} ha</span>
                                {lote.hectareasEnOtrasGarantias !== undefined && lote.hectareasEnOtrasGarantias > 0 && (
                                  <span className="text-purple-700 font-medium">
                                    ({formatHectareas(lote.hectareasEnOtrasGarantias)} ha en otra garantía)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-1.5 border-r border-slate-200 space-y-1">
                          <select
                            value={lote.garantiaConTipo || 'Farmer Rechnung'}
                            onChange={(e) => {
                              const tipo = e.target.value as TipoGarantiaCon;
                              setLotes((prev) =>
                                prev.map((item) =>
                                  item.idLote === lote.idLote
                                    ? {
                                        ...item,
                                        garantiaConTipo: tipo,
                                        garantiaConCuenta: tipo === 'Cliente' ? item.garantiaConCuenta : undefined,
                                        garantiaConNombre: tipo === 'Cliente' ? item.garantiaConNombre : tipo,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white font-semibold"
                          >
                            <option value="Farmer Rechnung">Farmer Rechnung</option>
                            <option value="Campo Grande">Campo Grande</option>
                            <option value="Cliente">Cliente registrado</option>
                          </select>

                          {lote.garantiaConTipo === 'Cliente' && (
                            <select
                              value={lote.garantiaConCuenta || ''}
                              onChange={(e) => {
                                const cuenta = e.target.value;
                                const cli = clientesList.find((c) => String(c.cuenta) === String(cuenta));
                                setLotes((prev) =>
                                  prev.map((item) =>
                                    item.idLote === lote.idLote
                                      ? {
                                          ...item,
                                          garantiaConCuenta: cuenta,
                                          garantiaConNombre: cli ? `${cli.cuenta} — ${cli.nombre}` : cuenta,
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white"
                            >
                              <option value="">-- Seleccionar cliente --</option>
                              {clientesList.map((c) => (
                                <option key={c.cuenta} value={c.cuenta}>
                                  {c.cuenta} — {c.nombre}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLote(lote.idLote)}
                            className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {bienes.map((bien) => (
                      <tr key={`b-${bien.idBien}`} className="hover:bg-slate-50">
                        <td className="p-1.5 border-r border-slate-200 font-mono font-bold text-blue-950">
                          {bien.numeroPoliza} — {bien.descripcion || bien.marca || bien.tipoBien}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-slate-800 font-medium">
                          {formatPropietario(bien.propietario, bien.cuentaPropietario)}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-950">
                          $us.{' '}
                          <input
                            type="number"
                            step="100"
                            min="0"
                            value={bien.valorGarantiaUSD || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setBienes((prev) =>
                                prev.map((item) =>
                                  item.idBien === bien.idBien ? { ...item, valorGarantiaUSD: val } : item
                                )
                              );
                            }}
                            className="w-28 px-1.5 py-0.5 text-right font-mono border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200 space-y-1">
                          <select
                            value={bien.garantiaConTipo || 'Farmer Rechnung'}
                            onChange={(e) => {
                              const tipo = e.target.value as TipoGarantiaCon;
                              setBienes((prev) =>
                                prev.map((item) =>
                                  item.idBien === bien.idBien
                                    ? {
                                        ...item,
                                        garantiaConTipo: tipo,
                                        garantiaConCuenta: tipo === 'Cliente' ? item.garantiaConCuenta : undefined,
                                        garantiaConNombre: tipo === 'Cliente' ? item.garantiaConNombre : tipo,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white font-semibold"
                          >
                            <option value="Farmer Rechnung">Farmer Rechnung</option>
                            <option value="Campo Grande">Campo Grande</option>
                            <option value="Cliente">Cliente registrado</option>
                          </select>

                          {bien.garantiaConTipo === 'Cliente' && (
                            <select
                              value={bien.garantiaConCuenta || ''}
                              onChange={(e) => {
                                const cuenta = e.target.value;
                                const cli = clientesList.find((c) => String(c.cuenta) === String(cuenta));
                                setBienes((prev) =>
                                  prev.map((item) =>
                                    item.idBien === bien.idBien
                                      ? {
                                          ...item,
                                          garantiaConCuenta: cuenta,
                                          garantiaConNombre: cli ? `${cli.cuenta} — ${cli.nombre}` : cuenta,
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white"
                            >
                              <option value="">-- Seleccionar cliente --</option>
                              {clientesList.map((c) => (
                                <option key={c.cuenta} value={c.cuenta}>
                                  {c.cuenta} — {c.nombre}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBien(bien.idBien)}
                            className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {lotes.length === 0 && bienes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                          No hay lotes ni bienes en esta garantía. Agregue al menos uno.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* TOTALES SEPARADOS */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                <div>
                  <span className="text-slate-500 font-semibold">Superficie Total: </span>
                  <strong className="font-mono text-emerald-900">{formatHectareas(totalHectareas)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Valor Total de Bienes: </span>
                  <strong className="font-mono text-emerald-900">
                    $us. {totalValorUSD.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>

            {/* OBSERVACIÓN */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Observación
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700 text-xs"
              />
            </div>

            {/* BOTONES ACCIÓN */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition cursor-pointer disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* MODAL SELECCIONAR LOTE */}
        <SeleccionarLoteModal
          isOpen={isAddingLote}
          onClose={() => setIsAddingLote(false)}
          onSelectLote={handleSelectLoteFromModal}
          alreadySelectedLoteIds={lotes.map((l) => l.idLote)}
          originalGarantiaLotes={originalLotes}
          clientesList={clientesList}
          modalidad={modalidad}
          defaultGarantiaConTipo={garantiaConTipo}
          defaultGarantiaCliente={selectedGarantiaCliente}
          availableLotes={availableLotes}
          idGarantiaActual={idGarantia}
        />

        {/* MODAL SELECCIONAR BIEN */}
        <SeleccionarBienModal
          isOpen={isAddingBien}
          onClose={() => setIsAddingBien(false)}
          onSelectBien={handleSelectBienFromModal}
          alreadySelectedBienIds={bienes.map((b) => b.idBien)}
          originalGarantiaBienIds={originalBienIds}
          currentNumeroSolicitud={numeroSolicitud}
          clientesList={clientesList}
          modalidad={modalidad}
          defaultGarantiaConTipo={garantiaConTipo}
          defaultGarantiaCliente={selectedGarantiaCliente}
          availableBienes={availableBienes}
        />
      </div>
    </div>
  );
};
