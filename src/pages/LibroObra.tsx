import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle, ArrowLeft, BookOpen, CheckCheck, Clock, Hash, Lock, Plus, ShieldCheck, UserPlus, WifiOff
} from "lucide-react";
import { db, LocalAnotacion } from "../db/database";
import { useAuth } from "../context/AuthContext";
import { syncEngine } from "../sync/syncEngine";
import { obraRepo, participanteObraRepo } from "../repositories/ObraRepository";
import { acuseRepo, anotacionRepo } from "../repositories/AnotacionRepository";
import {
  ETIQUETA_TIPO, ROLES_OBRA, TIPOS_ANOTACION, estaVencida, estadoDeHilo, rolEnObra, verificarCadena,
  type AnotacionEmitida, type RolObra, type TipoAnotacion
} from "../../server/libroObra";

const ROL_ETIQUETA: Record<RolObra, string> = {
  cliente: "Cliente", inspector: "Inspector", contratista: "Contratista", supervisor: "Supervisor"
};

const fecha = (ms?: number | null) =>
  ms ? new Date(ms).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—";

const campo = "w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white";
const boton = "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95";
const primario = `${boton} bg-blue-600 text-white hover:bg-blue-700`;
const secundario = `${boton} bg-slate-100 text-slate-600 hover:bg-slate-200`;

export default function LibroObra() {
  const [coincide, params] = useRoute<{ obraId: string }>("/libro-obra/:obraId");
  return coincide && params ? <DetalleObra obraId={params.obraId} /> : <ListaObras />;
}

function useContexto() {
  const { user } = useAuth();
  const clienteId = localStorage.getItem("active_client") || (user as any)?.cliente_id || "";
  const puedeAdministrar = !!user && ["administrador", "supervisor"].includes(user.perfil);
  return { user, clienteId, puedeAdministrar };
}

function ListaObras() {
  const { user, clienteId, puedeAdministrar } = useContexto();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");

  const obras = useLiveQuery(async () => {
    const todas = await db.obras.toArray();
    return todas.filter((o) => o.cliente_id === clienteId && !o.deleted_at && o.sync_status !== "pending_delete");
  }, [clienteId]) || [];
  const participaciones = useLiveQuery(
    async () => (user ? db.participantes_obra.where("usuario_id").equals(user.id).toArray() : []),
    [user?.id]
  ) || [];

  const visibles = obras.filter(
    (o) => puedeAdministrar || participaciones.some((p) => p.obra_id === o.uuid_sync && p.activo !== false)
  );

  const crear = async () => {
    setError("");
    if (!nombre.trim()) return setError("El nombre de la obra es obligatorio");
    if (!user || !clienteId) return setError("Seleccione un cliente activo");
    const usados = new Set(obras.map((o) => o.numero));
    let n = 0;
    while (usados.has(String(n).padStart(3, "0")) && n < 999) n++;
    if (usados.has(String(n).padStart(3, "0"))) return setError("El cliente ya usa los números de obra 000 a 999");
    const obra = await obraRepo.create({
      cliente_id: clienteId, numero: String(n).padStart(3, "0"), nombre: nombre.trim(),
      estado: "activa", libro_estado: "abierto"
    } as any);
    await participanteObraRepo.create({
      cliente_id: clienteId, obra_id: obra.uuid_sync, usuario_id: user.id, correo: user.correo,
      nombre: user.nombre, rol: "supervisor", activo: true
    } as any);
    setNombre(""); setCreando(false);
    syncEngine.triggerSync();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-screen text-slate-800">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600" /> Libro de Obra
          </h1>
          <p className="text-slate-500 font-medium">Un libro por obra, con folio consecutivo y anotaciones que no se editan.</p>
        </div>
        {puedeAdministrar && (
          <button className={`${primario} flex items-center gap-2`} onClick={() => setCreando(true)}>
            <Plus className="w-4 h-4" /> Nueva obra
          </button>
        )}
      </header>

      {creando && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 max-w-xl">
          <label htmlFor="obra-nombre" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre de la obra</label>
          <input id="obra-nombre" className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Sala de bombas, piso 3" />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex gap-2">
            <button className={primario} onClick={crear}>Crear obra</button>
            <button className={secundario} onClick={() => { setCreando(false); setError(""); }}>Cancelar</button>
          </div>
          <p className="text-xs text-slate-500">El número de obra (000 a 999) se asigna solo. Usted queda como supervisor de la obra.</p>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          {puedeAdministrar ? "Aún no hay obras. Cree la primera con «Nueva obra»." : "No participa en ninguna obra de este cliente."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((o) => (
            <Link key={o.uuid_sync} href={`/libro-obra/${o.uuid_sync}`}
              className="block bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:border-blue-300 transition">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 rounded-lg px-2 py-1">Obra {o.numero}</span>
                {o.libro_estado === "cerrado" && <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Cerrado</span>}
                {o.sync_status !== "synced" && <span className="text-xs font-bold text-amber-600 flex items-center gap-1"><WifiOff className="w-3 h-3" /> Sin sincronizar</span>}
              </div>
              <h2 className="mt-3 text-lg font-black text-slate-900">{o.nombre}</h2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DetalleObra({ obraId }: { obraId: string }) {
  const { user, clienteId, puedeAdministrar } = useContexto();
  const obra = useLiveQuery(() => db.obras.get(obraId), [obraId]);
  const participantes = useLiveQuery(
    async () => (await db.participantes_obra.where("obra_id").equals(obraId).toArray()).filter((p) => !p.deleted_at && p.sync_status !== "pending_delete"),
    [obraId]
  ) || [];
  const anotaciones = useLiveQuery(() => anotacionRepo.getByObra(obraId), [obraId]) || [];
  const acuses = useLiveQuery(() => acuseRepo.getByObra(obraId), [obraId]) || [];
  const usuarios = useLiveQuery(async () => {
    const todos = await db.users.toArray();
    return todos.filter((u) => u.activo !== false && !u.deleted_at && (u.cliente_id === clienteId || u.cliente_ids?.includes(clienteId)));
  }, [clienteId]) || [];

  const miRol = user ? rolEnObra(participantes.map((p) => ({ usuario_id: p.usuario_id, rol: p.rol, activo: p.activo })), user.id) : null;
  const cerrado = obra?.libro_estado === "cerrado";
  const nombreDe = (id: string) => participantes.find((p) => p.usuario_id === id)?.nombre || usuarios.find((u) => u.id === id)?.nombre || id;
  const emitidas = anotaciones.filter((a) => a.folio);

  const [cadena, setCadena] = useState<string>("");
  const verificar = async () => {
    const r = await verificarCadena(emitidas as unknown as AnotacionEmitida[]);
    setCadena(r.valida ? `Cadena íntegra: ${emitidas.length} anotaciones, folios y hashes consecutivos.` : `Cadena rota en el folio ${r.rotaEn}: ${r.motivo}`);
  };

  const darAcuse = async (a: LocalAnotacion) => {
    if (!user) return;
    await acuseRepo.create({
      cliente_id: clienteId, obra_id: obraId, anotacion_uuid: a.uuid_sync, usuario_id: user.id, acusado_en: Date.now()
    } as any);
    syncEngine.triggerSync();
  };

  if (!obra) {
    return <div className="p-8 text-slate-500">Obra no encontrada. <Link href="/libro-obra" className="text-blue-600 font-bold">Volver al libro</Link></div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-screen text-slate-800">
      <Link href="/libro-obra" className="text-sm font-bold text-slate-500 hover:text-blue-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Todas las obras</Link>
      <header className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 rounded-lg px-2 py-1">Obra {obra.numero}</span>
          <h1 className="mt-2 text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{obra.nombre}</h1>
          <p className="text-slate-500 font-medium text-sm">
            {emitidas.length} anotaciones emitidas{cerrado ? " · libro cerrado" : ""}
            {miRol ? ` · usted: ${ROL_ETIQUETA[miRol]}` : " · usted no participa en esta obra"}
          </p>
        </div>
        <button className={`${secundario} flex items-center gap-2`} onClick={verificar}><ShieldCheck className="w-4 h-4" /> Verificar cadena</button>
      </header>
      {cadena && <p role="status" className="text-sm font-medium bg-white border border-slate-200 rounded-2xl p-3">{cadena}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4" aria-label="Anotaciones">
          {miRol && !cerrado && (
            <NuevaAnotacion obraId={obraId} clienteId={clienteId} miRol={miRol} userId={user!.id}
              participantes={participantes} anotaciones={anotaciones} nombreDe={nombreDe} />
          )}
          {anotaciones.length === 0 && (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
              El libro no tiene anotaciones. La primera recibirá el folio 1.
            </div>
          )}
          {[...anotaciones].reverse().map((a) => {
            const estado = estadoDeHilo(a as any, anotaciones as any);
            const vencida = estaVencida(a as any, estado, Date.now());
            const miAcuse = acuses.some((x) => x.anotacion_uuid === a.uuid_sync && x.usuario_id === user?.id);
            const soyDestinatario = !!user && a.destinatarios.includes(user.id);
            return (
              <article key={a.uuid_sync} className={`bg-white rounded-3xl border p-5 shadow-sm ${vencida ? "border-red-300" : "border-slate-200/80"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {a.folio
                    ? <span className="font-mono font-bold text-white bg-slate-800 rounded-lg px-2 py-1">Folio {a.folio}</span>
                    : <span className="font-bold text-amber-700 bg-amber-50 rounded-lg px-2 py-1 flex items-center gap-1"><WifiOff className="w-3 h-3" /> Borrador firmado, sin folio</span>}
                  <span className="font-bold text-blue-700 bg-blue-50 rounded-lg px-2 py-1">{ETIQUETA_TIPO[a.tipo as TipoAnotacion]}</span>
                  {estado && <span className={`font-bold rounded-lg px-2 py-1 ${estado === "respondida" ? "text-green-700 bg-green-50" : vencida ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50"}`}>
                    {estado === "respondida" ? "Respondida" : vencida ? "Vencida" : "Espera respuesta"}</span>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-slate-800">{a.texto}</p>
                <dl className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                  <div><dt className="inline font-bold">De: </dt><dd className="inline">{nombreDe(a.autor_id)} ({ROL_ETIQUETA[a.autor_rol]})</dd></div>
                  <div><dt className="inline font-bold">Para: </dt><dd className="inline">{a.destinatarios.map(nombreDe).join(", ")}</dd></div>
                  <div><dt className="inline font-bold">Firmada: </dt><dd className="inline">{fecha(a.escrito_en)}</dd></div>
                  {a.plazo ? <div><dt className="inline font-bold">Plazo: </dt><dd className="inline flex-inline items-center">{fecha(a.plazo)}</dd></div> : null}
                  {a.recibido_en ? <div><dt className="inline font-bold">Recibida: </dt><dd className="inline">{fecha(a.recibido_en)}</dd></div> : null}
                  {a.hash ? <div className="font-mono"><dt className="inline font-bold font-sans"><Hash className="w-3 h-3 inline" /> </dt><dd className="inline">{a.hash.slice(0, 12)}…</dd></div> : null}
                </dl>
                {vencida && <p className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Plazo vencido sin respuesta</p>}
                {a.folio && soyDestinatario && (
                  miAcuse
                    ? <p className="mt-3 text-xs font-bold text-green-700 flex items-center gap-1"><CheckCheck className="w-4 h-4" /> Acuse registrado</p>
                    : <button className={`${secundario} mt-3 flex items-center gap-2`} onClick={() => darAcuse(a)}><CheckCheck className="w-4 h-4" /> Dar acuse de lectura</button>
                )}
              </article>
            );
          })}
        </section>

        <aside className="space-y-4" aria-label="Participantes">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Participantes</h2>
            <ul className="space-y-2">
              {participantes.map((p) => (
                <li key={p.uuid_sync} className="text-sm">
                  <span className="font-bold text-slate-800">{p.nombre || p.correo}</span>
                  <span className="block text-xs text-slate-500">{ROL_ETIQUETA[p.rol]}{p.empresa ? ` · ${p.empresa}` : ""}{p.especialidad ? ` · ${p.especialidad}` : ""}</span>
                </li>
              ))}
              {participantes.length === 0 && <li className="text-sm text-slate-500">Nadie participa todavía.</li>}
            </ul>
          </div>
          {puedeAdministrar && !cerrado && (
            <NuevoParticipante obraId={obraId} clienteId={clienteId} usuarios={usuarios} participantes={participantes} />
          )}
        </aside>
      </div>
    </div>
  );
}

function NuevoParticipante({ obraId, clienteId, usuarios, participantes }: {
  obraId: string; clienteId: string; usuarios: any[]; participantes: any[];
}) {
  const [usuarioId, setUsuarioId] = useState("");
  const [rol, setRol] = useState<RolObra>("contratista");
  const [empresa, setEmpresa] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const libres = usuarios.filter((u) => !participantes.some((p) => p.usuario_id === u.id));

  const agregar = async () => {
    const u = usuarios.find((x) => x.id === usuarioId);
    if (!u) return;
    await participanteObraRepo.create({
      cliente_id: clienteId, obra_id: obraId, usuario_id: u.id, correo: u.email, nombre: u.nombre,
      rol, empresa: empresa.trim() || undefined, especialidad: especialidad.trim() || undefined, activo: true
    } as any);
    setUsuarioId(""); setEmpresa(""); setEspecialidad("");
    syncEngine.triggerSync();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><UserPlus className="w-3 h-3" /> Agregar participante</h2>
      <label htmlFor="part-usuario" className="sr-only">Usuario</label>
      <select id="part-usuario" className={campo} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
        <option value="">Elegir usuario…</option>
        {libres.map((u) => <option key={u.uuid_sync} value={u.id}>{u.nombre} ({u.email})</option>)}
      </select>
      <label htmlFor="part-rol" className="sr-only">Rol en la obra</label>
      <select id="part-rol" className={campo} value={rol} onChange={(e) => setRol(e.target.value as RolObra)}>
        {ROLES_OBRA.map((r) => <option key={r} value={r}>{ROL_ETIQUETA[r]}</option>)}
      </select>
      <input id="part-empresa" aria-label="Empresa" className={campo} placeholder="Empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
      {rol === "contratista" && (
        <input id="part-especialidad" aria-label="Especialidad" className={campo} placeholder="Especialidad (ej.: eléctrica)" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} />
      )}
      <button className={primario} disabled={!usuarioId} onClick={agregar}>Agregar</button>
      <p className="text-xs text-slate-500">La invitación por correo llega en una próxima entrega; hoy el usuario debe existir en la aplicación.</p>
    </div>
  );
}

function NuevaAnotacion({ obraId, clienteId, miRol, userId, participantes, anotaciones, nombreDe }: {
  obraId: string; clienteId: string; miRol: RolObra; userId: string;
  participantes: any[]; anotaciones: LocalAnotacion[]; nombreDe: (id: string) => string;
}) {
  const [tipo, setTipo] = useState<TipoAnotacion>("instruccion");
  const [texto, setTexto] = useState("");
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [pideRespuesta, setPideRespuesta] = useState(false);
  const [plazo, setPlazo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState("");

  const posibles = useMemo(() => participantes.filter((p) => p.usuario_id !== userId && p.activo !== false), [participantes, userId]);
  const referenciables = anotaciones.filter((a) => a.folio);
  const exigeReferencia = tipo === "correccion" || tipo === "respuesta";

  const emitir = async () => {
    setError("");
    try {
      await anotacionRepo.emitir({
        cliente_id: clienteId, obra_id: obraId, tipo, texto, autor_id: userId, autor_rol: miRol, destinatarios,
        pide_respuesta: pideRespuesta, plazo: pideRespuesta && plazo ? new Date(plazo).getTime() : null,
        referencia_uuid: referencia || null, escrito_en: Date.now()
      });
      setTexto(""); setDestinatarios([]); setPideRespuesta(false); setPlazo(""); setReferencia("");
      syncEngine.triggerSync();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar la anotación");
    }
  };

  const alternar = (id: string) =>
    setDestinatarios((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nueva anotación · firma como {ROL_ETIQUETA[miRol]}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="an-tipo" className="text-xs font-bold text-slate-600">Tipo</label>
          <select id="an-tipo" className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAnotacion)}>
            {TIPOS_ANOTACION.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
          </select>
        </div>
        {exigeReferencia && (
          <div>
            <label htmlFor="an-ref" className="text-xs font-bold text-slate-600">{tipo === "correccion" ? "Anotación que corrige" : "Anotación que responde"}</label>
            <select id="an-ref" className={campo} value={referencia} onChange={(e) => setReferencia(e.target.value)}>
              <option value="">Elegir folio…</option>
              {referenciables.map((a) => <option key={a.uuid_sync} value={a.uuid_sync}>Folio {a.folio} · {ETIQUETA_TIPO[a.tipo as TipoAnotacion]}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="an-texto" className="text-xs font-bold text-slate-600">Texto</label>
        <textarea id="an-texto" rows={4} className={campo} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <fieldset>
        <legend className="text-xs font-bold text-slate-600 mb-1">Destinatarios</legend>
        <div className="flex flex-wrap gap-2">
          {posibles.map((p) => (
            <label key={p.uuid_sync} className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${destinatarios.includes(p.usuario_id) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>
              <input type="checkbox" className="sr-only" checked={destinatarios.includes(p.usuario_id)} onChange={() => alternar(p.usuario_id)} />
              {nombreDe(p.usuario_id)} · {ROL_ETIQUETA[p.rol as RolObra]}
            </label>
          ))}
          {posibles.length === 0 && <span className="text-xs text-slate-500">Agregue participantes para tener destinatarios.</span>}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input id="an-pide" type="checkbox" checked={pideRespuesta} onChange={(e) => setPideRespuesta(e.target.checked)} /> Pide respuesta
        </label>
        {pideRespuesta && (
          <div>
            <label htmlFor="an-plazo" className="text-xs font-bold text-slate-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Plazo</label>
            <input id="an-plazo" type="datetime-local" className={campo} value={plazo} onChange={(e) => setPlazo(e.target.value)} />
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 font-medium">{error}</p>}
      <button className={primario} onClick={emitir}>Firmar y emitir</button>
      <p className="text-xs text-slate-500">Una anotación emitida no se edita ni se borra: un error se corrige con otra anotación. Sin conexión queda como borrador firmado y recibe su folio al sincronizar.</p>
    </div>
  );
}
