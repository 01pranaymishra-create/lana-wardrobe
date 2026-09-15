import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Latest from "./pages/Latest";
import Category from "./pages/Category";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import Customize from "./pages/Customize";
import BulkOrders from "./pages/BulkOrders";
import ContactUs from "./pages/ContactUs";
import AboutUs from "./pages/AboutUs";
import ShippingReturns from "./pages/ShippingReturns";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import YourOrders from "./pages/YourOrders";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRoute from "./components/AdminRoute";
import AdminProducts from "./pages/AdminProducts";
import AdminAddProduct from "./pages/AdminAddProduct";
import AdminEditProduct from "./pages/AdminEditProduct";
import BestSellers from "./pages/BestSellers";
import Offers from "./pages/Offers";
import AdminOrders from "./pages/AdminOrders";
import AdminShipping from "./pages/AdminShipping";
import AdminReviews from "./pages/AdminReviews";
import AdminCustomers from "./pages/AdminCustomers";
import ScrollToTop from "./components/ScrollToTop";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/latest" element={<Latest />} />
        <Route path="/category/:category" element={<Category />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/cart" element={ <ProtectedRoute> <Cart /></ProtectedRoute>}/>
        <Route path="/wishlist" element={ <ProtectedRoute> <Wishlist /> </ProtectedRoute>}/>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/customize" element={<Customize />} />
        <Route path="/bulk-orders" element={<BulkOrders />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/shipping-returns" element={<ShippingReturns />}/>
        <Route path="/privacy-policy" element={<PrivacyPolicy />}/>
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />}/>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />}/>
        <Route path="/reset-password" element={<ResetPassword />}/>
        <Route path="/account" element={<ProtectedRoute> <Account /> </ProtectedRoute> }/>
        <Route path="/orders" element={<ProtectedRoute> <YourOrders /> </ProtectedRoute> } />
        <Route path="/admin" element={ <AdminRoute> <AdminDashboard /> </AdminRoute> } />
        <Route path="/admin/products" element={ <AdminRoute> <AdminProducts /> </AdminRoute>} />
        <Route path="/admin/products/add" element={ <AdminRoute> <AdminAddProduct /> </AdminRoute> } />
        <Route path="/admin/products/edit/:id" element={ <AdminRoute> <AdminEditProduct /> </AdminRoute> } />
        <Route path="/best-sellers" element={<BestSellers />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/admin/orders" element={<AdminRoute> <AdminOrders /></AdminRoute>}/>
        <Route path="/admin/shipping" element={ <AdminRoute> <AdminShipping /></AdminRoute>}/>
        <Route path="/admin/reviews" element={<AdminRoute> <AdminReviews /></AdminRoute>}/>
        <Route path="/admin/customers" element={<AdminRoute> <AdminCustomers /> </AdminRoute>}/>
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}

export default App;