const { WhopApi } = require("@whop/api");

const whopSdk = new WhopApi({
  companyApiKey: "apik_EjcvHgvnhPYxP_C3020674_C_71359f076f57d6d126cac8827a98a32bc580a757f7ea9ae0679a2c937cf601"
});

async function test() {
  try {
    console.log("Testing listPlans:");
    const plans = await whopSdk.companies.listPlans({ id: "biz_2T7tC1fnFVo6d4" });
    console.log("Plans found:", plans.data?.length || 0);
    
    console.log("\nTesting listProducts:");
    const products = await whopSdk.companies.listProducts({ id: "biz_2T7tC1fnFVo6d4" });
    console.log("Products found:", products.data?.length || 0);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

test();
