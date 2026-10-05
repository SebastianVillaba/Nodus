import React, { useState } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import type { Theme, CSSObject } from '@mui/material';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar from '@mui/material/AppBar';
import type { AppBarProps as MuiAppBarProps } from '@mui/material';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import LogoutIcon from '@mui/icons-material/Logout';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import Collapse from '@mui/material/Collapse';
import { useNavigate } from 'react-router-dom';
import { PointOfSale, LocalOffer, Add, Visibility } from '@mui/icons-material';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import ListSubheader from '@mui/material/ListSubheader';
import ApiIcon from '@mui/icons-material/Api';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import { clearSession } from '../../services/auth';
import { usePermisos } from '../../hooks/usePermission';

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

interface SidebarLayoutProps {
  children: React.ReactNode;
}

interface SubMenuItem {
  text: string;
  path: string;
  icon?: React.ReactNode;
  permiso?: string; // nombreSistema requerido; sin permiso = visible para todos
}

interface MenuItem {
  text: string;
  path?: string;
  icon: React.ReactNode;
  permiso?: string;
  subItems?: SubMenuItem[];
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const [openSubMenus, setOpenSubMenus] = useState<{ [key: string]: boolean }>({});
  const navigate = useNavigate();
  const permisos = usePermisos();

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const handleSubMenuToggle = (menuText: string) => {
    setOpenSubMenus((prev) => ({
      ...prev,
      [menuText]: !prev[menuText],
    }));
  };

  const menuSections = React.useMemo<MenuSection[]>(() => [
    // ──────────────── ABM ────────────────
    {
      label: 'ABM',
      items: [
        {
          text: 'ABM',
          icon: <InboxIcon />,
          subItems: [
            { text: 'Persona-Entidad', path: '/abm/personas', icon: <PeopleIcon />, permiso: 'ACCESO_ABM' },
            { text: 'Productos', path: '/abm/productos', icon: <InventoryIcon />, permiso: 'ACCESO_ABM' },
          ],
        },
      ],
    },
    // ──────────────── MOVIMIENTOS ────────────────
    {
      label: 'Movimientos',
      items: [
        {
          text: 'Facturación',
          path: '/facturacion',
          permiso: 'ACCESO_VENTAS',
          icon: <ReceiptIcon />,
        },
        {
          text: 'Pedidos',
          path: '/pedidos',
          permiso: 'ACCESO_PEDIDOS',
          icon: <ReceiptLongIcon />,
        },
        {
          text: 'Cobro de Créditos',
          path: '/cobranzas/cobranza',
          permiso: 'ACCESO_COBRANZAS',
          icon: <RequestQuoteIcon />,
        },
        {
          text: 'Arqueo de Caja',
          icon: <PointOfSale />,
          subItems: [
            { text: 'Arqueo de Caja', path: '/caja/arqueo', icon: <ReceiptLongIcon />, permiso: 'ACCESO_CAJA' },
          ],
        },
        {
          text: 'Compras',
          path: '/compras',
          permiso: 'ACCESO_COMPRAS',
          icon: <ShoppingCartIcon />,
        },
        {
          text: 'Ajuste / Stock Inicial',
          icon: <ApiIcon />,
          subItems: [
            { text: 'Ajustes', path: '/mercaderia/ajustes', icon: <InventoryIcon />, permiso: 'ACCESO_AJUSTES' },
            { text: 'Stock Inicial', path: '/mercaderia/stock-inicial', icon: <InventoryIcon />, permiso: 'ACCESO_AJUSTES' },
            { text: 'Carga de Productos',path: '/mercaderia/carga-productos',icon: <InventoryIcon />, permiso: 'ACCESO_CARGA_PRODUCTOS' }
          ],
        },
        {
          text: 'Mercadería',
          icon: <InventoryIcon />,
          subItems: [
            { text: 'Generación de Códigos', path: '/mercaderia/generacion-codigo-barra', icon: <InventoryIcon />, permiso: 'ACCESO_CARGA_PRODUCTOS' },
            { text: 'Impresión de Códigos', path: '/mercaderia/impresion-codigo-barra', icon: <InventoryIcon />, permiso: 'VER_STOCK' },
          ],
        }
      ],
    },
    // ──────────────── OFERTA ────────────────
    {
      label: 'Oferta',
      items: [
        {
          text: 'Oferta',
          icon: <LocalOffer />,
          subItems: [
            { text: 'Crear Ofertas', path: '/oferta/crear', icon: <Add />, permiso: 'ACCESO_OFERTAS' },
            { text: 'Ver Ofertas', path: '/oferta/ver', icon: <Visibility />, permiso: 'ACCESO_OFERTAS' },
          ],
        },
      ],
    },
    // ──────────────── CONSULTAS ────────────────
    {
      label: 'Consultas',
      items: [
        {
          text: 'Consulta Ventas',
          path: '/consultas/ventas',
          permiso: 'ACCESO_VENTAS',
          icon: <ReceiptLongIcon />,
        },
        {
          text: 'Consulta Arqueo de Caja',
          path: '/consultas/arqueo-caja',
          permiso: 'RPT_CAJA',
          icon: <PointOfSale />,
        },
        {
          text: 'Consulta Cobranzas',
          path: '/consultas/cobranzas',
          permiso: 'ACCESO_COBRANZAS',
          icon: <RequestQuoteIcon />,
        },
        {
          text: 'Historial de Cliente',
          path: '/consultas/historial-cliente',
          permiso: 'ACCESO_HISTORIAL_CLIENTE',
          icon: <PersonSearchIcon />,
        },
        {
          text: 'Mercaderia',
          icon: <InventoryIcon />,
          subItems: [
            { text: 'Consulta Stock', path: '/mercaderia/consulta-stock', icon: <InventoryIcon />, permiso: 'VER_STOCK' },
            { text: 'Consulta Carga de Productos', path: '/consultas/carga-productos', icon: <InventoryIcon />, permiso: 'ACCESO_CARGA_PRODUCTOS' }
          ],
        }
      ],
    },
    // ──────────────── REPORTES ────────────────
    {
      label: 'Reportes',
      items: [
        {
          text: 'Panel de Reportes',
          path: '/reportes',
          permiso: 'RPT_CAJA',
          icon: <ReceiptIcon />,
        },
      ],
    },
    // ──────────────── ADMINISTRACIÓN ────────────────
    {
      label: 'Administración',
      items: [
        {
          text: 'Administración',
          icon: <SettingsIcon />,
          subItems: [
            { text: 'Roles', path: '/administracion/roles', icon: <PeopleIcon />, permiso: 'ACCESO_SEGURIDAD' },
            { text: 'Usuarios', path: '/administracion/usuarios', icon: <PeopleIcon />, permiso: 'ACCESO_SEGURIDAD' },
            { text: 'Terminales', path: '/administracion/terminales', icon: <InventoryIcon />, permiso: 'ACCESO_SEGURIDAD' },
            { text: 'Timbrados', path: '/administracion/timbrados', icon: <ReceiptIcon />, permiso: 'ACCESO_TIMBRADOS' },
          ],
        },
        {
          text: 'Auditoría',
          path: '/auditoria',
          permiso: 'ACCESO_AUDITORIA',
          icon: <HistoryIcon />,
        },
      ],
    },
  ], []);

  // Menú filtrado por los permisos del usuario: se ocultan items, submenús y secciones vacías
  const menuVisible = React.useMemo<MenuSection[]>(() => {
    if (!permisos) return [];
    const puedeVer = (permiso?: string) => !permiso || permisos.has(permiso);

    return menuSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => puedeVer(item.permiso))
          .map((item) => item.subItems
            ? { ...item, subItems: item.subItems.filter((sub) => puedeVer(sub.permiso)) }
            : item)
          .filter((item) => !item.subItems || item.subItems.length > 0),
      }))
      .filter((section) => section.items.length > 0);
  }, [menuSections, permisos]);

  const renderMenuItem = (item: MenuItem) => (
    <React.Fragment key={item.text}>
      <ListItem disablePadding sx={{ display: 'block' }}>
        <ListItemButton
          onClick={() => {
            if (item.subItems) {
              handleSubMenuToggle(item.text);
            } else if (item.path) {
              navigate(item.path);
            }
          }}
          sx={{
            minHeight: 48,
            justifyContent: open ? 'initial' : 'center',
            px: 2.5,
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: open ? 3 : 'auto',
              justifyContent: 'center',
            }}
          >
            {item.icon}
          </ListItemIcon>
          <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0 }} />
          {item.subItems && open && (
            openSubMenus[item.text] ? <ExpandLess /> : <ExpandMore />
          )}
        </ListItemButton>
      </ListItem>

      {/* Submenú desplegable */}
      {item.subItems && (
        <Collapse in={openSubMenus[item.text]} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.subItems.map((subItem) => (
              <ListItem key={subItem.text} disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                  onClick={() => navigate(subItem.path)}
                  sx={{
                    minHeight: 48,
                    justifyContent: open ? 'initial' : 'center',
                    pl: 4,
                    px: 2.5,
                  }}
                >
                  {subItem.icon && (
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: open ? 3 : 'auto',
                        justifyContent: 'center',
                      }}
                    >
                      {subItem.icon}
                    </ListItemIcon>
                  )}
                  <ListItemText primary={subItem.text} sx={{ opacity: open ? 1 : 0 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
      )}
    </React.Fragment>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open} sx={{ backgroundColor: '#000000' }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{
              marginRight: 5,
              ...(open && { display: 'none' }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Nodus
          </Typography>
          <IconButton
            color="inherit"
            onClick={handleLogout}
            aria-label="cerrar sesión"
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        {menuVisible.map((section, sectionIndex) => (
          <React.Fragment key={section.label}>
            <List
              subheader={
                open ? (
                  <ListSubheader
                    component="div"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.70rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      lineHeight: '32px',
                      mt: sectionIndex === 0 ? 0 : 0.5,
                    }}
                  >
                    {section.label}
                  </ListSubheader>
                ) : undefined
              }
            >
              {section.items.map((item) => renderMenuItem(item))}
            </List>
            {sectionIndex < menuVisible.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <DrawerHeader />
        {children}
      </Box>
    </Box>
  );
}