// Acceso a datos: lectura de los archivos JSON con fetch y manejo de storage.

const CLAVES = {
  carrito: "ritmo-carrito",
  pedidos: "ritmo-pedidos",
  stock: "ritmo-stock",
  cupon: "ritmo-cupon",
  borrador: "ritmo-borrador-checkout",
};

const RUTAS_DATOS = {
  productos: "./data/productos.json",
  envios: "./data/envios.json",
  cupones: "./data/cupones.json",
  pagos: "./data/pagos.json",
};

const LIMITE_COMPRA = 2000;
const DEMORA_PAGO_MS = 1800;

async function pedirJson(ruta) {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) {
    throw new Error(`${ruta} respondió con estado ${respuesta.status}`);
  }
  return respuesta.json();
}

// Descarga en paralelo todos los JSON y los devuelve con el nombre de cada uno.
async function cargarDatos() {
  const nombres = Object.keys(RUTAS_DATOS);
  const contenidos = await Promise.all(Object.values(RUTAS_DATOS).map(pedirJson));
  return Object.fromEntries(nombres.map((nombre, indice) => [nombre, contenidos[indice]]));
}

// Simula la pasarela de pago: aprueba o rechaza según el monto.
function procesarPago(total) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      total > LIMITE_COMPRA
        ? reject(
            new Error(`el monto supera el límite de USD ${LIMITE_COMPRA}`),
          )
        : resolve(total);
    }, DEMORA_PAGO_MS);
  });
}

// ---------- Storage ----------

// Recuperar: devuelve el respaldo si la clave no existe o el JSON está dañado.
function leerGuardado(clave, respaldo, almacen = localStorage) {
  try {
    return JSON.parse(almacen.getItem(clave)) ?? respaldo;
  } catch {
    return respaldo;
  }
}

// Guardar o modificar: setItem sobrescribe el valor previo de la clave.
function guardarValor(clave, valor, almacen = localStorage) {
  try {
    almacen.setItem(clave, JSON.stringify(valor));
  } catch {
    return false;
  }
  return true;
}

// Borrar una sola clave.
function borrarValor(clave, almacen = localStorage) {
  almacen.removeItem(clave);
}

// Vaciar todo el storage de la aplicación.
function vaciarAlmacenamiento() {
  localStorage.clear();
  sessionStorage.clear();
}
