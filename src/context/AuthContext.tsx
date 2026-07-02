*** Begin Patch
*** Update File: src/context/AuthContext.tsx
@@
-  const [user, setUser] = useState<Usuario | null>(() => {
-    // Intentar recuperar sesión persistida desde localStorage de forma segura
-    let savedUserJson = localStorage.getItem('auth_user');
-    
-    if (localStorage.getItem('is_authenticated') === 'true' && !savedUserJson) {
-      localStorage.removeItem('is_authenticated');
-      localStorage.removeItem('auth_token');
-      sessionStorage.removeItem('auth_token');
-    }
-    localStorage.removeItem('auth_token');
-
-    if (savedUserJson && !sessionStorage.getItem('auth_token')) {
-      localStorage.removeItem('auth_user');
-      localStorage.removeItem('is_authenticated');
-      return null;
-    }
-
-    if (savedUserJson) {
-      try {
-        const u = JSON.parse(savedUserJson) as Usuario;
-        if (u) {
-          u.perfil = normalizePerfil(u.perfil);
-          u.puedeEditarMantenimientos = u.perfil !== 'visita' && u.perfil !== 'cliente';
-          configureRoleContext(u, false);
-        }
-        return u;
-      } catch (e) {
-        localStorage.removeItem('auth_user');
-      }
-    }
-    return null;
-  });
+  // Restaurar usuario persistido desde localStorage si existe.
+  const [user, setUser] = useState<Usuario | null>(() => {
+    const savedUserJson = localStorage.getItem('auth_user');
+
+    // Si hay un usuario persistido localmente, restaurarlo (no borrarlo por ausencia de token).
+    if (savedUserJson) {
+      try {
+        const u = JSON.parse(savedUserJson) as Usuario;
+        if (u) {
+          u.perfil = normalizePerfil(u.perfil);
+          u.puedeEditarMantenimientos = u.perfil !== 'visita' && u.perfil !== 'cliente';
+          // No forzamos borrar 'active_client' en reload; respetamos el contexto actual.
+          configureRoleContext(u, false);
+        }
+        return u;
+      } catch (e) {
+        // Si el JSON está corrupto, limpiar para evitar errores posteriores
+        localStorage.removeItem('auth_user');
+        localStorage.removeItem('is_authenticated');
+      }
+    }
+
+    // Si no hay usuario persistido, estado inicial nulo
+    return null;
+  });
@@
-  const biometricLogin = async (correo: string): Promise<boolean> => {
-    try {
-      if (!sessionStorage.getItem('auth_token')) {
-        return false;
-      }
-      const localUser = await db.users.where('email').equalsIgnoreCase(correo).first();
-      if (localUser && localUser.activo) {
-        const normalizedPerfil = normalizePerfil(localUser.rol);
-        const loggedUser: Usuario = {
-          id: localUser.id || localUser.uuid_sync,
-          nombre: localUser.nombre,
-          correo: localUser.email,
-          perfil: normalizedPerfil,
-          activo: localUser.activo,
-          puedeEditarMantenimientos: normalizedPerfil !== 'visita' && normalizedPerfil !== 'cliente',
-          cliente_id: localUser.cliente_id,
-          cliente_ids: localUser.cliente_ids || []
-        };
-
-        if (!configureRoleContext(loggedUser)) {
-          return false;
-        }
-
-        setUser(loggedUser);
-        localStorage.setItem('auth_user', JSON.stringify(loggedUser));
-        localStorage.setItem('is_authenticated', 'true');
-        return true;
-      }
-    } catch (dbError) {
-      console.error('Error durante autenticación biométrica offline', dbError);
-    }
-    return false;
-  };
+  // Permitir login biométrico offline usando DB local (no depender de session token)
+  const biometricLogin = async (correo: string): Promise<boolean> => {
+    try {
+      const localUser = await db.users.where('email').equalsIgnoreCase(correo).first();
+      if (localUser && localUser.activo) {
+        const normalizedPerfil = normalizePerfil(localUser.rol);
+        const loggedUser: Usuario = {
+          id: localUser.id || localUser.uuid_sync,
+          nombre: localUser.nombre,
+          correo: localUser.email,
+          perfil: normalizedPerfil,
+          activo: localUser.activo,
+          puedeEditarMantenimientos: normalizedPerfil !== 'visita' && normalizedPerfil !== 'cliente',
+          cliente_id: localUser.cliente_id,
+          cliente_ids: localUser.cliente_ids || []
+        };
+
+        if (!configureRoleContext(loggedUser)) {
+          return false;
+        }
+
+        setUser(loggedUser);
+        localStorage.setItem('auth_user', JSON.stringify(loggedUser));
+        localStorage.setItem('is_authenticated', 'true');
+        // Nota: no dependemos de auth_token para autenticación offline.
+        return true;
+      }
+    } catch (dbError) {
+      console.error('Error durante autenticación biométrica offline', dbError);
+    }
+    return false;
+  };
*** End Patch