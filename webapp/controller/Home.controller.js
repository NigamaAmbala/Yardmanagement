sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment"
],
function (Controller, Fragment) {
    "use strict";

    return Controller.extend("com.app.yardmanagement.controller.Home", {
        onInit: function () {

        },
        Onpressloginbtn: async function () {
            if (!this.ologinDailog) {
                this.ologinDailog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "com.app.yardmanagement.Fragments.loginDailog",
                    controller: this
                });
                this.getView().addDependent(this.ologinDailog);
            }

            this.ologinDailog.open();
        },

        onCloseDialog: function () {
            if (this.ologinDailog.isOpen()) {
                this.ologinDailog.close()
            }
        },
        //on login button in login dialog box
        onLoginCredentials: function () {
            // var ousername = this.getView().byId("idusernameInput").getValue();
            // var opassword = this.getView().byId("idPasswordInput").getValue();
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteDashboard")
            
        },
    });
});
