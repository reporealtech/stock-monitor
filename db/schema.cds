namespace my.stock;

type Quantity : Integer;

entity MaterialStock {
  key ID : UUID;
  material : String;
  quantity : Quantity;
  storageLocation : String;
}