/**
 * PANTALLA: Mi Empresa
 * 
 * Objetivo: Configuración centralizada de datos corporativos
 * - RUT, Dirección, Datos de contacto
 * - Logo corporativo para personalización de informes
 * - Datos de supervisor y administrador
 * - Sincronización con servidor
 * 
 * @module pages/MiEmpresa
 */

import React, { useState, useEffect } from "react";
import {
  Building2,
  Upload,
  Save,
  AlertCircle,
  CheckCircle,
  Loader,
  Mail,
  Phone,
  MapPin,
  User,
  Shield,
  Eye,
  EyeOff,
  X,
  Download,
  Edit2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAppStore } from "../store/useAppStore";
import { db } from "../db/database";

interface EmpresaData {
  id: string;
  uuid_sync: string;
  nombre: string;
  rut: string;
  direccion: string;
  ciudad: string;
  region: string;
  telefono: string;
  email: string;
  
  // Logo corporativo
  logo_base64?: string;
  logo_mime?: string;
  logo_nombre?: string;
  
  // Contactos
  contactos: {
    supervisor: {
      nombre: string;
      email: string;
      telefono: string;
      cargo: string;
    };
    administrador: {
      nombre: string;
      email: string;
      telefono: string;
      cargo: string;
    };
    manager: {
      nombre: string;
      email: string;
      telefono: string;
      cargo: string;
    };
  };
  
  // Metadata
  updated_at: number;
  sync_status: 'pending' | 'synced';
}

export default function MiEmpresa() {
  const { user, permisos } = useAuth();
  const clients = useAppStore(state => state.clients);
  const activeClientId = localStorage.getItem("active_client");
  
  // Estados del formulario
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Mensajes
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Datos de empresa
  const [empresaData, setEmpresaData] = useState<EmpresaData>({
    id: "",
    uuid_sync: "",
    nombre: "",
    rut: "",
    direccion: "",
    ciudad: "",
    region: "",
    telefono: "",
    email: "",
    contactos: {
      supervisor: { nombre: "", email: "", telefono: "", cargo: "Supervisor" },
      administrador: { nombre: "", email: "", telefono: "", cargo: "Administrador" },
      manager: { nombre: "", email: "", telefono: "", cargo: "Manager" },
    },
    updated_at: Date.now(),
    sync_status: 'pending',
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Cargar datos de empresa
  useEffect(() => {
    loadEmpresaData();
  }, [activeClientId]);

  const loadEmpresaData = async () => {
    setIsLoading(true);
    try {
      if (!activeClientId) {
        setErrorMessage("No hay cliente activo seleccionado.");
        setIsLoading(false);
        return;
      }

      // Buscar en localStorage primero (cache)
      const cached = localStorage.getItem(`empresa_config_${activeClientId}`);
      if (cached) {
        try {
          const parsedData = JSON.parse(cached);
          setEmpresaData(parsedData);
          if (parsedData.logo_base64) {
            setLogoPreview(parsedData.logo_base64);
          }
        } catch (e) {
          console.warn("Error parsing cached empresa data:", e);
        }
      }

      // Buscar en BD local (Dexie)
      const clientData = await db.clients.where('uuid_sync').equals(activeClientId).first();
      if (clientData) {
        const rawData = clientData.data;
        let parsedData: any = {};

        if (typeof rawData === 'string') {
          try {
            parsedData = JSON.parse(rawData);
          } catch {
            parsedData = rawData;
          }
        } else {
          parsedData = rawData || {};
        }

        const consolidated: EmpresaData = {
          id: clientData.id,
          uuid_sync: clientData.uuid_sync,
          nombre: parsedData.nombre || clientData.nombre || "",
          rut: parsedData.rut || clientData.rut || "",
          direccion: parsedData.direccion || clientData.direccion || "",
          ciudad: parsedData.ciudad || "",
          region: parsedData.region || "",
          telefono: parsedData.telefono || clientData.telefono || "",
          email: parsedData.email || clientData.email || "",
          logo_base64: parsedData.logo_base64,
          logo_mime: parsedData.logo_mime || "image/png",
          logo_nombre: parsedData.logo_nombre,
          contactos: {
            supervisor: {
              nombre: parsedData.contactos?.supervisor?.nombre || parsedData.contacto_nombre || "",
              email: parsedData.contactos?.supervisor?.email || parsedData.contacto_correo || "",
              telefono: parsedData.contactos?.supervisor?.telefono || "",
              cargo: parsedData.contactos?.supervisor?.cargo || "Supervisor",
            },
            administrador: {
              nombre: parsedData.contactos?.administrador?.nombre || "",
              email: parsedData.contactos?.administrador?.email || "",
              telefono: parsedData.contactos?.administrador?.telefono || "",
              cargo: parsedData.contactos?.administrador?.cargo || "Administrador",
            },
            manager: {
              nombre: parsedData.contactos?.manager?.nombre || "",
              email: parsedData.contactos?.manager?.email || "",
              telefono: parsedData.contactos?.manager?.telefono || "",
              cargo: parsedData.contactos?.manager?.cargo || "Manager",
            },
          },
          updated_at: parsedData.updated_at || Date.now(),
          sync_status: parsedData.sync_status || 'synced',
        };

        setEmpresaData(consolidated);
        if (consolidated.logo_base64) {
          setLogoPreview(consolidated.logo_base64);
        }

        // Guardar en cache
        localStorage.setItem(`empresa_config_${activeClientId}`, JSON.stringify(consolidated));
      }
    } catch (error) {
      console.error("Error loading empresa data:", error);
      setErrorMessage("Error al cargar datos de la empresa.");
    } finally {
      setIsLoading(false);
    }
  };

  const validateRUT = (rut: string): boolean => {
    const cleanedRut = rut.replace(/[^\dkK]/g, "");
    if (cleanedRut.length < 7 || cleanedRut.length > 9) return false;

    const rutNum = cleanedRut.slice(0, -1);
    const dvChar = cleanedRut.slice(-1).toUpperCase();

    let sum = 0;
    let multiplier = 2;

    for (let i = rutNum.length - 1; i >= 0; i--) {
      sum += parseInt(rutNum[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = 11 - (sum % 11);
    const dv = remainder === 11 ? "0" : remainder === 10 ? "K" : remainder.toString();

    return dv === dvChar;
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("El logo no debe exceder 2MB.");
      return;
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Solo se permiten archivos de imagen.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoPreview(base64);
      setLogoFile(file);
      setEmpresaData(prev => ({
        ...prev,
        logo_base64: base64,
        logo_mime: file.type,
        logo_nombre: file.name,
      }));
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    // Validaciones
    if (!empresaData.nombre.trim()) {
      setErrorMessage("El nombre de la empresa es obligatorio.");
      return;
    }

    if (!empresaData.rut.trim()) {
      setErrorMessage("El RUT es obligatorio.");
      return;
    }

    if (!validateRUT(empresaData.rut)) {
      setErrorMessage("El RUT ingresado no es válido.");
      return;
    }

    if (!empresaData.direccion.trim()) {
      setErrorMessage("La dirección es obligatoria.");
      return;
    }

    if (!empresaData.region) {
      setErrorMessage("La región es obligatoria.");
      return;
    }

    if (!empresaData.telefono.trim()) {
      setErrorMessage("El teléfono es obligatorio.");
      return;
    }

    if (!empresaData.email.trim()) {
      setErrorMessage("El email es obligatorio.");
      return;
    }

    // Validar contactos
    const { supervisor, administrador, manager } = empresaData.contactos;

    if (!supervisor.nombre.trim() || !supervisor.email.trim()) {
      setErrorMessage("Los datos del supervisor son obligatorios.");
      return;
    }

    if (!administrador.nombre.trim() || !administrador.email.trim()) {
      setErrorMessage("Los datos del administrador son obligatorios.");
      return;
    }

    if (!manager.nombre.trim() || !manager.email.trim()) {
      setErrorMessage("Los datos del manager son obligatorios.");
      return;
    }

    setIsSaving(true);
    try {
      const updatedData = {
        ...empresaData,
        updated_at: Date.now(),
        sync_status: 'pending',
      };

      // Guardar en Dexie
      await db.clients.update(empresaData.uuid_sync, {
        nombre: empresaData.nombre,
        rut: empresaData.rut,
        direccion: empresaData.direccion,
        data: JSON.stringify({
          nombre: empresaData.nombre,
          rut: empresaData.rut,
          direccion: empresaData.direccion,
          ciudad: empresaData.ciudad,
          region: empresaData.region,
          telefono: empresaData.telefono,
          email: empresaData.email,
          logo_base64: empresaData.logo_base64,
          logo_mime: empresaData.logo_mime,
          logo_nombre: empresaData.logo_nombre,
          contactos: empresaData.contactos,
          updated_at: updatedData.updated_at,
          sync_status: updatedData.sync_status,
        }),
        updated_at: updatedData.updated_at,
      });

      // Guardar en cache local
      localStorage.setItem(`empresa_config_${activeClientId}`, JSON.stringify(updatedData));

      // Trigger sync
      try {
        const { syncEngine } = await import("../sync/syncEngine");
        await syncEngine.triggerSync();
      } catch (e) {
        console.warn("Sync trigger failed:", e);
      }

      setSuccessMessage("Datos de empresa guardados exitosamente.");
      setIsEditMode(false);
      setErrorMessage("");
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error saving empresa data:", error);
      setErrorMessage("Error al guardar los datos de la empresa.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setLogoPreview(null);
    setLogoFile(null);
    loadEmpresaData();
  };

  const handleDownloadLogo = () => {
    if (!logoPreview) return;

    const link = document.createElement("a");
    link.href = logoPreview;
    link.download = empresaData.logo_nombre || "logo.png";
    link.click();
  };

  const regions = [
    "Arica y Parinacota",
    "Tarapacá",
    "Antofagasta",
    "Atacama",
    "Coquimbo",
    "Valparaíso",
    "Metropolitana",
    "Libertador General Bernardo O'Higgins",
    "Maule",
    "Ñuble",
    "Biobío",
    "La Araucanía",
    "Los Ríos",
    "Los Lagos",
    "Aysén",
    "Magallanes",
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Cargando datos de empresa...</p>
        </div>
      </div>
    );
  }

  if (!user || user.perfil === 'visita') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Denegado</h2>
        <p className="text-slate-600">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase">Mi Empresa</h1>
              <p className="text-slate-500 text-sm mt-1">Configuración centralizada de datos corporativos</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">{successMessage}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-900">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Logo Section */}
          <div className="lg:col-span-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-black uppercase text-slate-900 mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Logo Corporativo
              </h2>

              <div className="aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-4 relative">
                {logoPreview ? (
                  <>
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                    {isEditMode && (
                      <button
                        onClick={() => {
                          setLogoPreview(null);
                          setLogoFile(null);
                          setEmpresaData(prev => ({
                            ...prev,
                            logo_base64: undefined,
                            logo_mime: undefined,
                            logo_nombre: undefined,
                          }));
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400 uppercase">
                      {isEditMode ? "Haz clic o arrastra un logo" : "Sin logo"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">PNG, JPG (máx 2MB)</p>
                  </div>
                )}
                {isEditMode && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                )}
              </div>

              {logoPreview && !isEditMode && (
                <button
                  onClick={handleDownloadLogo}
                  className="w-full mt-4 py-2 bg-blue-100 text-blue-600 text-xs font-bold uppercase rounded-xl hover:bg-blue-200 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Descargar
                </button>
              )}

              <p className="text-[10px] text-slate-400 mt-4 text-center">
                Se utiliza en la personalización de informes HVAC
              </p>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-8">
            {/* Datos Generales */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Datos Generales
                </h2>
                {!isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="px-3 py-1.5 bg-blue-100 text-blue-600 text-xs font-bold uppercase rounded-lg hover:bg-blue-200 transition flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* Nombre Empresa */}
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                    Nombre de Empresa
                  </label>
                  <input
                    type="text"
                    value={empresaData.nombre}
                    onChange={(e) =>
                      setEmpresaData(prev => ({ ...prev, nombre: e.target.value }))
                    }
                    disabled={!isEditMode}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      isEditMode
                        ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        : "border-slate-100 bg-slate-50 text-slate-600"
                    } outline-none`}
                    placeholder="CMMS HVAC PRO"
                  />
                </div>

                {/* RUT */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                      RUT
                    </label>
                    <input
                      type="text"
                      value={empresaData.rut}
                      onChange={(e) =>
                        setEmpresaData(prev => ({ ...prev, rut: e.target.value }))
                      }
                      disabled={!isEditMode}
                      className={`w-full px-4 py-3 rounded-xl border transition-all ${
                        isEditMode
                          ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                          : "border-slate-100 bg-slate-50 text-slate-600"
                      } outline-none`}
                      placeholder="12.345.678-9"
                    />
                  </div>

                  {/* Región */}
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                      Región
                    </label>
                    <select
                      value={empresaData.region}
                      onChange={(e) =>
                        setEmpresaData(prev => ({ ...prev, region: e.target.value }))
                      }
                      disabled={!isEditMode}
                      className={`w-full px-4 py-3 rounded-xl border transition-all ${
                        isEditMode
                          ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                          : "border-slate-100 bg-slate-50 text-slate-600"
                      } outline-none`}
                    >
                      <option value="">Seleccionar región</option>
                      {regions.map(region => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" /> Dirección
                  </label>
                  <input
                    type="text"
                    value={empresaData.direccion}
                    onChange={(e) =>
                      setEmpresaData(prev => ({ ...prev, direccion: e.target.value }))
                    }
                    disabled={!isEditMode}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      isEditMode
                        ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        : "border-slate-100 bg-slate-50 text-slate-600"
                    } outline-none`}
                    placeholder="Av. Principal 123"
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={empresaData.ciudad}
                    onChange={(e) =>
                      setEmpresaData(prev => ({ ...prev, ciudad: e.target.value }))
                    }
                    disabled={!isEditMode}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${
                      isEditMode
                        ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        : "border-slate-100 bg-slate-50 text-slate-600"
                    } outline-none`}
                    placeholder="Santiago"
                  />
                </div>

                {/* Teléfono y Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block mb-1 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> Teléfono
                    </label>
                    <input
                      type="tel"
                      value={empresaData.telefono}
                      onChange={(e) =>
                        setEmpresaData(prev => ({ ...prev, telefono: e.target.value }))
                      }
                      disabled={!isEditMode}
                      className={`w-full px-4 py-3 rounded-xl border transition-all ${
                        isEditMode
                          ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                          : "border-slate-100 bg-slate-50 text-slate-600"
                      } outline-none`}
                      placeholder="+56 2 1234 5678"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block mb-1 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </label>
                    <input
                      type="email"
                      value={empresaData.email}
                      onChange={(e) =>
                        setEmpresaData(prev => ({ ...prev, email: e.target.value }))
                      }
                      disabled={!isEditMode}
                      className={`w-full px-4 py-3 rounded-xl border transition-all ${
                        isEditMode
                          ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                          : "border-slate-100 bg-slate-50 text-slate-600"
                      } outline-none`}
                      placeholder="contacto@empresa.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contactos */}
            <div className="space-y-4">
              {/* Supervisor */}
              <ContactCard
                title="Supervisor"
                icon={<User className="w-4 h-4" />}
                data={empresaData.contactos.supervisor}
                onChange={(value) =>
                  setEmpresaData(prev => ({
                    ...prev,
                    contactos: { ...prev.contactos, supervisor: value },
                  }))
                }
                isEditMode={isEditMode}
              />

              {/* Administrador */}
              <ContactCard
                title="Administrador"
                icon={<Shield className="w-4 h-4" />}
                data={empresaData.contactos.administrador}
                onChange={(value) =>
                  setEmpresaData(prev => ({
                    ...prev,
                    contactos: { ...prev.contactos, administrador: value },
                  }))
                }
                isEditMode={isEditMode}
              />

              {/* Manager */}
              <ContactCard
                title="Manager/Director"
                icon={<User className="w-4 h-4" />}
                data={empresaData.contactos.manager}
                onChange={(value) =>
                  setEmpresaData(prev => ({
                    ...prev,
                    contactos: { ...prev.contactos, manager: value },
                  }))
                }
                isEditMode={isEditMode}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditMode && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 md:p-8">
            <div className="max-w-6xl mx-auto flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-6 py-3 bg-slate-100 text-slate-600 font-bold uppercase text-xs rounded-xl hover:bg-slate-200 transition disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 bg-blue-600 text-white font-bold uppercase text-xs rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Spacing for action buttons */}
        {isEditMode && <div className="h-28" />}
      </div>
    </div>
  );
}

/**
 * Componente: Tarjeta de Contacto
 */
interface ContactCardProps {
  title: string;
  icon: React.ReactNode;
  data: {
    nombre: string;
    email: string;
    telefono: string;
    cargo: string;
  };
  onChange: (data: any) => void;
  isEditMode: boolean;
}

function ContactCard({ title, icon, data, onChange, isEditMode }: ContactCardProps) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-black uppercase text-slate-900 mb-4 flex items-center gap-2">
        {icon} {title}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
            Nombre
          </label>
          <input
            type="text"
            value={data.nombre}
            onChange={(e) =>
              onChange({ ...data, nombre: e.target.value })
            }
            disabled={!isEditMode}
            className={`w-full px-4 py-3 rounded-xl border transition-all ${
              isEditMode
                ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                : "border-slate-100 bg-slate-50 text-slate-600"
            } outline-none`}
            placeholder={`${title}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              Email
            </label>
            <input
              type="email"
              value={data.email}
              onChange={(e) =>
                onChange({ ...data, email: e.target.value })
              }
              disabled={!isEditMode}
              className={`w-full px-4 py-3 rounded-xl border transition-all ${
                isEditMode
                  ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  : "border-slate-100 bg-slate-50 text-slate-600"
              } outline-none`}
              placeholder="email@empresa.com"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              value={data.telefono}
              onChange={(e) =>
                onChange({ ...data, telefono: e.target.value })
              }
              disabled={!isEditMode}
              className={`w-full px-4 py-3 rounded-xl border transition-all ${
                isEditMode
                  ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  : "border-slate-100 bg-slate-50 text-slate-600"
              } outline-none`}
              placeholder="+56 9 1234 5678"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
