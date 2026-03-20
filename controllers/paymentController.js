// const Stripe = require("stripe");
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// exports.createStripeSession = async (req, res) => {
//   try {
//     const { productData } = req.body;

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       mode: "payment",
//       line_items: [
//         {
//           price_data: {
//             currency: "usd",
//             product_data: {
//               name: "Product Promotion Fee",
//             },
//             unit_amount: 5000, // $50
//           },
//           quantity: 1,
//         },
//       ],
//       success_url: "http://localhost:3000/payment-success",
//       cancel_url: "http://localhost:3000/post-product",
//       metadata: {
//         productData: JSON.stringify(productData),
//       },
//     });

//     res.json({ url: session.url });

//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// const axios = require("axios");

// exports.createChapaPayment = async (req, res) => {
//   try {
//     const { productData } = req.body;

//     const tx_ref = "tx-" + Date.now();

//     const response = await axios.post(
//       "https://api.chapa.co/v1/transaction/initialize",
//       {
//         amount: "200", // 200 ETB
//         currency: "ETB",
//         email: "test@email.com",
//         first_name: "User",
//         last_name: "Name",
//         tx_ref,
//         callback_url: "http://localhost:5000/api/payment/chapa/verify",
//         return_url: "http://localhost:3000/payment-success",
//         meta: {
//           productData: JSON.stringify(productData),
//         },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
//         },
//       }
//     );

//     res.json({ url: response.data.data.checkout_url });

//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
// exports.verifyChapaPayment = async (req, res) => {
//   const { tx_ref } = req.query;

//   // Call Chapa verify API
//   const verify = await axios.get(
//     `https://api.chapa.co/v1/transaction/verify/${tx_ref}`,
//     {
//       headers: {
//         Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
//       },
//     }
//   );

//   if (verify.data.status === "success") {
//     const productData = JSON.parse(verify.data.data.meta.productData);

//     // SAVE TO DB
//     const newProduct = new Product(productData);
//     await newProduct.save();

//     return res.redirect("http://localhost:3000/");
//   }

//   res.send("Payment not verified");
// };