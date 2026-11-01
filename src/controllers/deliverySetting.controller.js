import ShopSetting from "../models/shopSetting.model.js";
import { asyncErrorHandler } from "../utils/asyncErrorHandler.js";
import CustomError from "../utils/customError.js";
import { clearDeliveryCache } from "../services/deliveryFee.service.js";

// GET /delivery-settings - Fetch delivery settings (car gate fee and note)
export const getDeliverySettings = asyncErrorHandler(async (req, res, next) => {
  const shopSetting = await ShopSetting.findOne({ isActive: true });

  const deliveryData = {
    carGateFee: Number(shopSetting?.delivery?.carGateFee ?? 0),
    carGateNote:
      shopSetting?.delivery?.carGateNote ||
      "ကားဂိတ်ခကို ပစ္စည်းရောက်ရှိချိန်တွင် ပေးချေရပါမည်",
  };

  res.status(200).json({
    success: true,
    data: deliveryData,
  });
});

// PATCH /delivery-settings - Update delivery settings
export const updateDeliverySettings = asyncErrorHandler(
  async (req, res, next) => {
    const { carGateFee, carGateNote } = req.body;

    let shopSetting = await ShopSetting.findOne({ isActive: true });
    if (!shopSetting) {
      shopSetting = new ShopSetting({
        shopName: "Devi House",
        address: "Yangon, Myanmar",
        phoneNumber: "09798938874",
        isActive: true,
      });
    }

    if (!shopSetting.delivery) {
      shopSetting.delivery = {
        carGateFee: 0,
        carGateNote: "ကားဂိတ်ခကို ပစ္စည်းရောက်ရှိချိန်တွင် ပေးချေရပါမည်",
      };
    }

    if (carGateFee !== undefined) {
      const num = Number(carGateFee);
      if (isNaN(num) || num < 0) {
        return next(
          new CustomError(400, "Car gate fee must be a non-negative number")
        );
      }
      shopSetting.delivery.carGateFee = num;
    }

    if (carGateNote !== undefined) {
      shopSetting.delivery.carGateNote = String(carGateNote).trim();
    }

    shopSetting.updatedBy = req.user._id;
    await shopSetting.save();

    clearDeliveryCache();

    res.status(200).json({
      success: true,
      message: "Delivery settings updated successfully",
      data: {
        carGateFee: shopSetting.delivery.carGateFee,
        carGateNote: shopSetting.delivery.carGateNote,
      },
    });
  }
);
