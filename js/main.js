// Ritmo Sport: simulador de tienda deportiva (catálogo → carrito → checkout → pedido).

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const estado = {
  productos: [],
  envios: [],
  cupones: [],
  pagos: [],
  carrito: leerGuardado(CLAVES.carrito, []),
  pedidos: leerGuardado(CLAVES.pedidos, []),
  cupon: null,
  seleccion: { envio: null, pago: null },
  filtros: { texto: "", categoria: "Todas", orden: "destacados" },
  vista: "tienda",
};

// ---------- Elementos del DOM ----------

const elemento = (id) => document.getElementById(id);

const vistas = {
  tienda: elemento("vista-tienda"),
  checkout: elemento("vista-checkout"),
  pedidos: elemento("vista-pedidos"),
};
const panelCarrito = elemento("panel-carrito");
const catalogo = elemento("catalogo");
const filtrosCategoria = elemento("filtros-categoria");
const inputBuscar = elemento("input-buscar");
const selectorOrden = elemento("selector-orden");
const contenedorCarrito = elemento("contenedor-carrito");
const totalesCarrito = {
  total: elemento("total-carrito"),
  contador: elemento("contador-carrito"),
  btnContinuar: elemento("btn-continuar"),
  btnVaciar: elemento("btn-vaciar"),
};
const contadorPedidos = elemento("contador-pedidos");
const formCheckout = elemento("form-checkout");
const camposDireccion = elemento("campos-direccion");
const opcionesEnvio = elemento("opciones-envio");
const selectorPago = elemento("selector-pago");
const resumenCompra = elemento("resumen-compra");
const inputCupon = elemento("input-cupon");
const estadoCupon = elemento("estado-cupon");
const btnConfirmar = elemento("btn-confirmar");
const listaPedidos = elemento("lista-pedidos");
const btnVaciarPedidos = elemento("btn-vaciar-pedidos");
const btnReiniciar = elemento("btn-reiniciar");
const selectorMoneda = elemento("selector-moneda");
const botonMoneda = elemento("boton-moneda");
const menuMoneda = elemento("menu-moneda");
const botonesNavegacion = document.querySelectorAll(".nav-boton");

// ---------- Consultas y cálculos ----------

const buscarProducto = (id) => estado.productos.find((producto) => producto.id === id);

// Une cada ítem del carrito con los datos de su producto.
const itemsCarrito = () =>
  estado.carrito.map(({ id, cantidad }) => ({ ...buscarProducto(id), cantidad }));

const cantidadesEnCarrito = () =>
  estado.carrito.reduce(
    (cantidades, { id, cantidad }) => ({ ...cantidades, [id]: cantidad }),
    {},
  );

const redondear = (valor) => Math.round(valor * 100) / 100;

function filtrarProductos() {
  const { texto, categoria, orden } = estado.filtros;
  const busqueda = texto.trim().toLowerCase();

  const coincidentes = estado.productos.filter(
    (producto) =>
      (categoria === "Todas" || producto.categoria === categoria) &&
      producto.nombre.toLowerCase().includes(busqueda),
  );

  const criterios = {
    menor: (productoA, productoB) => productoA.precio - productoB.precio,
    mayor: (productoA, productoB) => productoB.precio - productoA.precio,
    nombre: (productoA, productoB) => productoA.nombre.localeCompare(productoB.nombre),
  };
  return criterios[orden] ? [...coincidentes].sort(criterios[orden]) : coincidentes;
}

// Un cupón solo aplica mientras el subtotal alcance su mínimo.
const cuponVigente = (subtotal) =>
  estado.cupon && subtotal >= estado.cupon.minimo ? estado.cupon : null;

function calcularResumen() {
  const items = itemsCarrito();
  const subtotal = items.reduce(
    (acumulado, { precio, cantidad }) => acumulado + precio * cantidad,
    0,
  );
  const unidades = items.reduce((acumulado, { cantidad }) => acumulado + cantidad, 0);

  const cupon = cuponVigente(subtotal);
  const descuentoCupon = redondear((subtotal * (cupon?.descuento ?? 0)) / 100);

  const envio =
    estado.envios.find(({ id }) => id === estado.seleccion.envio) ?? estado.envios[0];
  const pago =
    estado.pagos.find(({ id }) => id === estado.seleccion.pago) ?? estado.pagos[0];

  const costoEnvio = subtotal >= (envio?.gratisDesde ?? Infinity) ? 0 : (envio?.costo ?? 0);
  const ajustePago = redondear(((subtotal - descuentoCupon) * (pago?.ajuste ?? 0)) / 100);
  const total = redondear(subtotal - descuentoCupon + costoEnvio + ajustePago);

  return { subtotal, unidades, cupon, descuentoCupon, costoEnvio, ajustePago, total, envio, pago };
}

// ---------- Persistencia ----------

function guardarCarrito() {
  estado.carrito.length > 0
    ? guardarValor(CLAVES.carrito, estado.carrito)
    : borrarValor(CLAVES.carrito);
}

function guardarStock() {
  const stockPorProducto = estado.productos.reduce(
    (stockAcumulado, { id, stock }) => ({ ...stockAcumulado, [id]: stock }),
    {},
  );
  guardarValor(CLAVES.stock, stockPorProducto);
}

function guardarPedidos() {
  estado.pedidos.length > 0
    ? guardarValor(CLAVES.pedidos, estado.pedidos)
    : borrarValor(CLAVES.pedidos);
}

function guardarCupon() {
  estado.cupon
    ? guardarValor(CLAVES.cupon, estado.cupon.codigo)
    : borrarValor(CLAVES.cupon);
}

// El borrador del formulario vive en sessionStorage: se pierde al cerrar la pestaña.
function guardarBorrador() {
  guardarValor(CLAVES.borrador, Object.fromEntries(new FormData(formCheckout)), sessionStorage);
}

// ---------- Renderizado ----------

function renderTienda() {
  renderCatalogo(catalogo, filtrarProductos(), cantidadesEnCarrito());
}

function renderPanelCarrito() {
  renderCarrito(contenedorCarrito, itemsCarrito());
  renderTotalCarrito(totalesCarrito, calcularResumen());
}

function renderCheckout() {
  const resumen = calcularResumen();
  renderResumenCompra(resumenCompra, itemsCarrito(), resumen, resumen.cupon);
  renderEstadoCupon(estadoCupon, resumen.cupon);
  camposDireccion.hidden = !(resumen.envio?.requiereDireccion ?? true);
}

function renderTodo() {
  renderTienda();
  renderPanelCarrito();
  contadorPedidos.textContent = estado.pedidos.length;
  if (estado.vista === "checkout") renderCheckout();
}

function cambiarVista(nombreVista) {
  if (nombreVista === "checkout" && estado.carrito.length === 0) {
    notificar("Agregá productos al carrito antes de continuar.", "error");
    return;
  }

  estado.vista = nombreVista;
  Object.entries(vistas).forEach(([nombre, seccion]) => {
    seccion.hidden = nombre !== nombreVista;
  });
  panelCarrito.hidden = nombreVista !== "tienda";
  botonesNavegacion.forEach((botonNavegacion) => {
    botonNavegacion.toggleAttribute("aria-current", botonNavegacion.dataset.nav === nombreVista);
  });

  if (nombreVista === "checkout") renderCheckout();
  if (nombreVista === "pedidos") renderPedidos(listaPedidos, estado.pedidos);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Carrito ----------

// Suma una unidad respetando el stock. Devuelve true si pudo agregarla.
function sumarUnidad({ id }) {
  const producto = buscarProducto(Number(id));
  const item = estado.carrito.find((itemCarrito) => itemCarrito.id === producto.id);

  if ((item?.cantidad ?? 0) >= producto.stock) {
    notificar(`No hay más stock de ${producto.nombre}.`, "error");
    return false;
  }
  item ? item.cantidad++ : estado.carrito.push({ id: producto.id, cantidad: 1 });
  guardarCarrito();
  renderTodo();
  return true;
}

function agregarAlCarrito(datosBoton) {
  if (sumarUnidad(datosBoton)) {
    notificar(`${buscarProducto(Number(datosBoton.id)).nombre} se agregó al carrito.`);
  }
}

function restarUnidad({ id }) {
  const item = estado.carrito.find((itemCarrito) => itemCarrito.id === Number(id));
  if (!item) return;
  item.cantidad--;
  if (item.cantidad === 0) quitarDelCarrito({ id });
  else {
    guardarCarrito();
    renderTodo();
  }
}

function quitarDelCarrito({ id }) {
  estado.carrito = estado.carrito.filter((item) => item.id !== Number(id));
  guardarCarrito();
  renderTodo();
}

async function vaciarCarrito() {
  const confirmado = await confirmar({
    titulo: "¿Vaciar el carrito?",
    texto: "Se quitarán todos los productos que agregaste.",
    textoConfirmar: "Sí, vaciar",
  });
  if (!confirmado) return;

  estado.carrito = [];
  guardarCarrito();
  renderTodo();
  notificar("Vaciaste el carrito.");
}

// ---------- Filtros ----------

function seleccionarCategoria({ categoria }) {
  estado.filtros.categoria = categoria;
  renderFiltrosCategoria(filtrosCategoria, categoriasDisponibles(), categoria);
  renderTienda();
}

const categoriasDisponibles = () => [
  ...new Set(estado.productos.map(({ categoria }) => categoria)),
];

// ---------- Checkout ----------

function restaurarBorrador() {
  const borrador = leerGuardado(CLAVES.borrador, {}, sessionStorage);
  Object.entries(borrador).forEach(([campo, valor]) => {
    if (formCheckout.elements[campo]) formCheckout.elements[campo].value = valor;
  });
  estado.seleccion.envio = borrador.envio || estado.envios[0]?.id;
  estado.seleccion.pago = borrador.pago || estado.pagos[0]?.id;
}

function renderOpcionesCheckout() {
  renderOpcionesEnvio(opcionesEnvio, estado.envios, estado.seleccion.envio);
  renderOpcionesPago(selectorPago, estado.pagos, estado.seleccion.pago);
}

function actualizarSeleccion() {
  const { envio, pago } = Object.fromEntries(new FormData(formCheckout));
  estado.seleccion = { envio, pago };
  guardarBorrador();
  renderCheckout();
}

function aplicarCupon() {
  const codigo = inputCupon.value.trim().toUpperCase();
  const cupon = estado.cupones.find((cuponGuardado) => cuponGuardado.codigo === codigo);
  const { subtotal } = calcularResumen();

  if (!cupon) {
    notificar(codigo === "" ? "Ingresá un código de cupón." : "Ese cupón no existe.", "error");
    return;
  }
  if (subtotal < cupon.minimo) {
    notificar(`Este cupón requiere una compra mínima de ${formatearPrecio(cupon.minimo)}.`, "error");
    return;
  }
  estado.cupon = cupon;
  guardarCupon();
  inputCupon.value = "";
  renderCheckout();
  notificar(`Cupón ${cupon.codigo} aplicado.`);
}

function quitarCupon() {
  estado.cupon = null;
  guardarCupon();
  renderCheckout();
  notificar("Quitaste el cupón.");
}

function validarDatos({ nombre, email, direccion, ciudad }, requiereDireccion) {
  const errores = {};
  if (nombre.trim().length < 3) errores.nombre = "Ingresá tu nombre completo.";
  if (!REGEX_EMAIL.test(email.trim())) errores.email = "Ingresá un email válido.";
  if (requiereDireccion) {
    if (direccion.trim().length < 5) errores.direccion = "Ingresá calle y número.";
    if (ciudad.trim() === "") errores.ciudad = "Ingresá tu ciudad.";
  }
  return errores;
}

// Verifica que ningún producto del carrito supere el stock disponible.
const hayItemsSinStock = () =>
  itemsCarrito().some(({ cantidad, stock }) => cantidad > stock);

function crearPedido(datosCliente, resumen) {
  const { nombre, email, direccion, ciudad } = datosCliente;
  const { envio, pago } = resumen;
  return {
    numero: `PED-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    fecha: new Date().toISOString(),
    cliente: { nombre: nombre.trim(), email: email.trim(), direccion: direccion.trim(), ciudad: ciudad.trim() },
    items: itemsCarrito().map(({ id, nombre: nombreProducto, precio, cantidad }) => ({
      id,
      nombre: nombreProducto,
      precio,
      cantidad,
    })),
    resumen: { subtotal: resumen.subtotal, total: resumen.total },
    envio: `${envio.nombre} (${envio.detalle})`,
    pago: pago.nombre,
  };
}

// Descuenta del stock cada unidad comprada y persiste el resultado.
function descontarStock() {
  estado.carrito.forEach(({ id, cantidad }) => {
    buscarProducto(id).stock -= cantidad;
  });
  guardarStock();
}

function limpiarTrasCompra() {
  estado.carrito = [];
  estado.cupon = null;
  guardarCarrito();
  guardarCupon();
  borrarValor(CLAVES.borrador, sessionStorage);
  formCheckout.reset();
  restaurarBorrador();
  renderOpcionesCheckout();
}

async function confirmarCompra(evento) {
  evento.preventDefault();
  const resumen = calcularResumen();
  const datosFormulario = Object.fromEntries(new FormData(formCheckout));
  const errores = validarDatos(datosFormulario, resumen.envio.requiereDireccion);
  mostrarErroresFormulario(formCheckout, errores);

  if (Object.keys(errores).length > 0) {
    notificar("Revisá los datos marcados en el formulario.", "error");
    return;
  }
  if (hayItemsSinStock()) {
    mostrarError("Stock insuficiente", "Algún producto ya no tiene unidades suficientes. Revisá tu carrito.");
    return;
  }

  const confirmado = await confirmar({
    titulo: "¿Confirmás tu compra?",
    texto: `Vas a pagar ${formatearPrecio(resumen.total)} con ${resumen.pago.nombre}.`,
    textoConfirmar: "Confirmar y pagar",
  });
  if (!confirmado) return;

  btnConfirmar.disabled = true;
  mostrarProcesando();
  let pedido = null;
  try {
    await procesarPago(resumen.total);
    pedido = crearPedido(datosFormulario, resumen);
  } catch ({ message }) {
    await mostrarError("No pudimos procesar el pago", `Motivo: ${message}. Tu carrito sigue intacto.`);
  } finally {
    btnConfirmar.disabled = false;
  }

  if (!pedido) return;
  estado.pedidos.unshift(pedido);
  guardarPedidos();
  descontarStock();
  limpiarTrasCompra();
  cambiarVista("tienda");
  renderTodo();
  await mostrarComprobante(pedido);
}

// ---------- Pedidos ----------

async function eliminarPedido({ numero }) {
  const confirmado = await confirmar({
    titulo: `¿Eliminar el pedido ${numero}?`,
    texto: "Se borrará de tu historial.",
    textoConfirmar: "Sí, eliminar",
  });
  if (!confirmado) return;

  estado.pedidos = estado.pedidos.filter((pedido) => pedido.numero !== numero);
  guardarPedidos();
  renderPedidos(listaPedidos, estado.pedidos);
  contadorPedidos.textContent = estado.pedidos.length;
  notificar(`Se eliminó el pedido ${numero}.`);
}

async function vaciarPedidos() {
  if (estado.pedidos.length === 0) {
    notificar("No hay pedidos para borrar.", "error");
    return;
  }
  const confirmado = await confirmar({
    titulo: "¿Borrar todo el historial?",
    texto: "Esta acción elimina todos tus pedidos.",
    textoConfirmar: "Sí, borrar todo",
  });
  if (!confirmado) return;

  estado.pedidos = [];
  guardarPedidos();
  renderPedidos(listaPedidos, estado.pedidos);
  contadorPedidos.textContent = 0;
  notificar("Historial vacío.");
}

async function reiniciarTienda() {
  const confirmado = await confirmar({
    titulo: "¿Restablecer la tienda?",
    texto: "Se borran carrito, pedidos, stock y datos guardados en este navegador.",
    textoConfirmar: "Sí, restablecer",
  });
  if (!confirmado) return;

  vaciarAlmacenamiento();
  Object.assign(estado, { carrito: [], pedidos: [], cupon: null });
  formCheckout.reset();
  estado.filtros = { texto: "", categoria: "Todas", orden: "destacados" };
  inputBuscar.value = "";
  selectorOrden.value = estado.filtros.orden;
  cambiarVista("tienda");
  await cargarTienda();
  notificar("La tienda volvió a su estado inicial.");
}

// ---------- Carga inicial ----------

function aplicarStockGuardado(productos) {
  const stockGuardado = leerGuardado(CLAVES.stock, {});
  return productos.map((producto) => ({
    ...producto,
    stock: stockGuardado[producto.id] ?? producto.stock,
  }));
}

// Quita del carrito productos inexistentes y ajusta cantidades al stock actual.
function sanearCarrito() {
  estado.carrito = estado.carrito
    .filter(({ id }) => buscarProducto(id))
    .map(({ id, cantidad }) => ({
      id,
      cantidad: Math.min(cantidad, buscarProducto(id).stock),
    }))
    .filter(({ cantidad }) => cantidad > 0);
  guardarCarrito();
}

async function cargarTienda() {
  renderEstadoCatalogo(catalogo, { mensaje: "Cargando productos…" });
  let cargaExitosa = false;

  try {
    const { productos, envios, cupones, pagos } = await cargarDatos();
    Object.assign(estado, { productos: aplicarStockGuardado(productos), envios, cupones, pagos });
    estado.cupon =
      cupones.find(({ codigo }) => codigo === leerGuardado(CLAVES.cupon, null)) ?? null;
    cargaExitosa = true;
  } catch ({ message }) {
    renderEstadoCatalogo(catalogo, {
      mensaje: `No pudimos cargar el catálogo (${message}). ${
        location.protocol === "file:"
          ? "Abrí el sitio desde un servidor local (por ejemplo, la extensión Live Server) en lugar de hacer doble clic en index.html."
          : "Verificá tu conexión e intentá de nuevo."
      }`,
      conReintento: true,
    });
    notificar("Error al cargar los datos.", "error");
  } finally {
    btnConfirmar.disabled = !cargaExitosa;
  }

  if (!cargaExitosa) return;
  sanearCarrito();
  renderFiltrosCategoria(filtrosCategoria, categoriasDisponibles(), estado.filtros.categoria);
  restaurarBorrador();
  renderOpcionesCheckout();
  renderTodo();
}

// ---------- Selector de moneda ----------

function alternarMenuMoneda(abrir = menuMoneda.hidden) {
  menuMoneda.hidden = !abrir;
  botonMoneda.setAttribute("aria-expanded", abrir);
}

function activarSelectorMoneda() {
  botonMoneda.addEventListener("click", () => alternarMenuMoneda());
  menuMoneda.addEventListener("click", () => {
    alternarMenuMoneda(false);
    botonMoneda.focus();
  });
  document.addEventListener("click", ({ target }) => {
    if (!selectorMoneda.contains(target)) alternarMenuMoneda(false);
  });
  document.addEventListener("keydown", ({ key }) => {
    if (key !== "Escape" || menuMoneda.hidden) return;
    alternarMenuMoneda(false);
    botonMoneda.focus();
  });
}

// ---------- Eventos ----------

const acciones = {
  agregar: agregarAlCarrito,
  sumar: sumarUnidad,
  restar: restarUnidad,
  quitar: quitarDelCarrito,
  categoria: seleccionarCategoria,
  reintentar: cargarTienda,
  "quitar-cupon": quitarCupon,
  "eliminar-pedido": eliminarPedido,
};

function activarEventos() {
  document.addEventListener("click", (evento) => {
    const botonAccion = evento.target.closest("[data-accion]");
    if (botonAccion) acciones[botonAccion.dataset.accion]?.(botonAccion.dataset);

    const enlaceNavegacion = evento.target.closest("[data-nav]");
    if (!enlaceNavegacion) return;
    evento.preventDefault();
    cambiarVista(enlaceNavegacion.dataset.nav);
  });

  inputBuscar.addEventListener("input", () => {
    estado.filtros.texto = inputBuscar.value;
    renderTienda();
  });
  selectorOrden.addEventListener("change", () => {
    estado.filtros.orden = selectorOrden.value;
    renderTienda();
  });

  totalesCarrito.btnVaciar.addEventListener("click", vaciarCarrito);
  elemento("btn-aplicar-cupon").addEventListener("click", aplicarCupon);
  inputCupon.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    aplicarCupon();
  });

  formCheckout.addEventListener("input", guardarBorrador);
  formCheckout.addEventListener("change", actualizarSeleccion);
  formCheckout.addEventListener("submit", confirmarCompra);

  btnVaciarPedidos.addEventListener("click", vaciarPedidos);
  btnReiniciar.addEventListener("click", reiniciarTienda);
}

contadorPedidos.textContent = estado.pedidos.length;
activarEventos();
activarSelectorMoneda();
cargarTienda();
